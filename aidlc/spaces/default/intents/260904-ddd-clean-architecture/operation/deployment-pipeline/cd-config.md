# CD Config — DDD／クリーンアーキテクチャ改善

## 対象と前提

このリポジトリの「デプロイ」は 2 段です。(1) 変更を PR で `main` に取り込む、(2) 利用プロジェクトがタグを `scripts/install.ts` で引く。実行環境（dev／staging／prod）は無く、配布物は git のタグそのものです。scope `refactor` では CI Pipeline（3.7）と Infrastructure Design（3.4）が SKIP なので、`ci-config`・`quality-gates`・`infrastructure-specification`・`cicd-pipeline` は存在せず、既存の `.github/workflows/ci.yml`・`deep-spec-analysis/scripts/release.ts`・`deep-spec-analysis/scripts/install.ts`・`.claude/sensors/aidlc-pr-review-clean.md` を証拠にして設計しています。新しい CI／CD の設定ファイルは追加しません（理由は末尾の「変更しないもの」）。

入力は Build and Test の [`build-and-test-summary.md`](../../construction/build-and-test/build-and-test-summary.md)（T-BT-01〜08 Met）と [`test-results.md`](../../construction/build-and-test/test-results.md)、Code Generation の [`code-summary.md`](../../construction/code-generation/code-summary.md)（サンドボックス A／B／A→update の byte 一致）。決定は [`deployment-pipeline-questions.md`](./deployment-pipeline-questions.md)（Q1 タグなし、Q2 `.codex/tools/` を HEAD へ、Q3 マージはオーナー）。

| 項目 | 値 |
|---|---|
| リポジトリ | `amadeus-dlc/aidlc-deep-spec-analysis-plugin`（public、default `main`） |
| `main` の保護 | branch protection なし、ruleset なし、auto-merge 無効、squash／merge／rebase いずれも許可 |
| PR のチェック | `ci`（GitHub Actions）、CodeRabbit、Devin Review。#133〜#137 はこの 3 つが SUCCESS で squash-merge |
| 現在のタグ | `v0.5.0`（`.aidlc-plugin/plugin.json` の `version` と一致） |
| 作業ツリー | `main` 上の未コミット変更（deep-spec-analysis、aidlc レコード、codekb、memory）。`aidlc-workflows` の gitlink は親が記録する a277af21 と同一 |

## パイプライン定義

| # | 段 | 何をするか | 合否 |
|---|---|---|---|
| 0 | 事前確認 | `.codex/tools/` の 2 ファイルを HEAD へ戻す（Q2）。`git -C aidlc-workflows status` が clean で gitlink が a277af21。Build and Test と同じ検証を作業ツリーで再実行 | tsc 0、`build-tools --check` 同期、`bun test --coverage` 0 fail、validate Errors 0、7 harness build OK |
| 1 | ブランチ | `main` から `refactor/ddd-clean-architecture` を切る（trunk-based、短命） | — |
| 2 | コミット | 変更一式を 1 つ以上のコミットに。監査シャード `aidlc/spaces/default/intents/260904-ddd-clean-architecture/audit/<host>-<clone>.md` を必ず含める（監査ログ同梱規律）。Conventional Commits・英語・叙事スタイル、attribution 行なし | `git status` に監査シャードの未追跡変更が残らない |
| 3 | PR | `gh pr create --base main` で PR。本文は下のテンプレート。FR8 が未実装であることと #138 を明記 | PR が open |
| 4 | チェック | `ci`（typecheck、`build-tools --check`、`bun test --coverage`、validate、7 harness）、CodeRabbit、Devin Review。レビュー指摘に対応し、`pr-review-clean` センサーで未解決スレッド 0・レビュー系チェック完了を確認 | 3 チェック SUCCESS、`pass: true` |
| 5 | マージ | オーナーが GitHub 上で **squash-merge**（Q3）。squash の件名は PR 件名＋`(#N)` | `main` に 1 コミット |
| 6 | 事後 | `main` を pull し、サンドボックスへ `--from <checkout>` で導入して `aidlc-plugin-test` が CLEAN（スモーク）。PR 作成後に監査シャードへ増えた行は、このリポジトリの既存パターン（#135、#137）どおり追いの chore PR で運ぶ | CLEAN、Changed 0 / Drops 0 |
| 7 | リリース | 今回は切らない（Q1）。次に外部に見える変更を出すときに `bun deep-spec-analysis/scripts/release.ts <version>` | — |

## 昇格マトリクスとゲート

```
[作業ツリー] --(段 0 の検証)--> [PR: refactor/ddd-clean-architecture]
      --(ci + CodeRabbit + Devin Review + pr-review-clean)--> [オーナーの手動マージ]
      --(squash)--> [main] --(段 6 スモーク)--> (今回はここまで)
      --(release.ts, 後日)--> [タグ vX.Y.Z] --(install.ts --tag / 最新安定タグ)--> [利用プロジェクト]
```

| ゲート | 条件 | 種別 |
|---|---|---|
| PR 作成前 | 段 0 の 5 検証がすべて成功、監査シャード同梱、`aidlc-workflows` 無変更 | 自動（私が実行） |
| マージ前 | `ci`・CodeRabbit・Devin Review が SUCCESS、未解決スレッド 0 | 自動＋レビュー対応 |
| マージ | オーナーの手動承認（GitHub 上の squash-merge） | 手動 |
| マージ後 | サンドボックス導入が CLEAN | 自動（私が実行） |
| タグ | 今回なし。切るときは CI の `--check-tag` が manifest と突き合わせる | 手動起動・自動検査 |

## コマンド（Deployment Execution で使う）

```bash
# 段 0: 導入コピーを戻し、submodule を確認し、検証を再実行
git checkout -- .codex/tools/aidlc-lib.ts .codex/tools/aidlc-sensor-traceability.ts
git -C aidlc-workflows status --short            # 何も出ない
git diff --submodule=short -- aidlc-workflows     # 何も出ない（gitlink a277af21）
(cd deep-spec-analysis && bunx tsc --noEmit)
(cd deep-spec-analysis && bun scripts/build-tools.ts --check)
(cd deep-spec-analysis && bun test --coverage)
(cd deep-spec-analysis && bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .)
for h in claude codex copilot cursor kiro kiro-ide opencode; do
  (cd deep-spec-analysis && bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . "$h")
done

# 段 1〜3: ブランチ、コミット、PR
git switch -c refactor/ddd-clean-architecture
git status --short                                # 監査シャードが含まれていることを確認
git add -A && git commit -m "refactor: the verify directory is the aggregate the repositories store"
git push -u origin refactor/ddd-clean-architecture
gh pr create --base main --title "refactor: the verify directory is the aggregate the repositories store" --body-file <本文>

# 段 4: チェックとレビューの確認
gh pr checks <N> --watch
bun .claude/tools/aidlc-sensor-pr-review-clean.ts --stage deployment-execution \
  --output-path aidlc/spaces/default/intents/260904-ddd-clean-architecture/operation/deployment-execution/pr-<N>.pr-review.md

# 段 6: マージ後のスモーク
git switch main && git pull --ff-only
bun deep-spec-analysis/scripts/install.ts --project <sandbox> --from "$PWD"
bun aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install <sandbox> --harness claude
```

## PR 本文テンプレート

```markdown
## Summary
- Repository の語彙を保存・検索・取得・削除に閉じ、`DesignVerifyDirectory`／`VerificationDirectory` 集約と `FindingsSchema` 値オブジェクトへ適合と cross-check の有無を移した（オーナー裁定 2026-09-04）
- `DirectoryFinalizationLock` を `kernel/adapter` に共有、`Json`／`validateSchema`／`canonicalStringify` を `kernel/infrastructure` へ、Refinement を `design/domain` へ統合
- 外部仕様は byte 不変（契約 1〜4、golden、findings JSON、verdict、文言、正準順、solver pin）

## Not in this PR
- FR8（本家 aidlc-workflows のゼロ Unit 経路の修正）は「`aidlc-workflows/` は開発対象ではない」裁定で撤回し未実装。追跡: #138（本家 awslabs/aidlc-workflows#1011／#1020）
- `.codex/tools/` の暫定同期は HEAD へ戻した

## Verification
- `bunx tsc --noEmit` 0、`build-tools --check` 同期、`bun test --coverage` 577 pass / 1 skip / 0 fail（関数 99.83% / 行 99.94%）
- `aidlc-plugin-validate` Errors 0、7 harness build OK
- サンドボックス A／B／A→update: 10 entry すべて byte 一致、2 回目発火は収束、`aidlc-plugin-test` CLEAN

## Record
- AI-DLC レコード `aidlc/spaces/default/intents/260904-ddd-clean-architecture/`（監査シャード同梱）
- 裁定の記録: `deep-spec-analysis/docs/decisions.md`／`.ja.md`
```

## 変更しないもの

- `.github/workflows/ci.yml` は変更しない。必要な検査（typecheck、生成物同期、テスト、validate、7 harness build、タグ検査）を既に持ち、この Intent は新しい検査を要求しない
- リポジトリ設定（branch protection、auto-merge）は変更しない。承認は Q3 のとおりオーナーの手動マージで担保する
- `aidlc-workflows/` の gitlink は動かさない（`## Forbidden`）
