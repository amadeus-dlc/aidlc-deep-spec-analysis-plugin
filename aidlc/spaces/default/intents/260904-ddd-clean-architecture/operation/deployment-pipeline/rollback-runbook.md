# Rollback Runbook — DDD／クリーンアーキテクチャ改善

## 引き金

| 引き金 | 検出 | 対応 |
|---|---|---|
| PR のチェックが赤（`ci`、CodeRabbit、Devin Review） | GitHub のチェック | R1 |
| マージ後に `main` の CI が赤、またはスモーク（サンドボックス導入）が CLEAN にならない | `gh run list --branch main`、`aidlc-plugin-test` | R2 |
| マージ後に外部仕様の逸脱が見つかる（golden 差分、verdict 文言、findings JSON の形） | 利用側の報告、`bun test` | R2 |
| タグを切った後に不具合が見つかる（今回はタグを切らないが、後日まとめて切ったとき） | 利用側の報告 | R3、R4 |

## 手順

### R1. マージ前（PR 上で直す）

1. 原因を特定し、同じブランチに修正コミットを積む（force-push はしない。レビューの差分が追えなくなる）
2. `cd-config.md` 段 0 の検証を作業ツリーで再実行してから push
3. チェックが green に戻ったら段 4 へ戻る。直せない場合は PR を close し、原因を #138 か新しい issue に記録する

### R2. マージ後、タグを切っていない場合（revert PR）

`main` には直接 push せず、revert も PR で行う。

```bash
git switch main && git pull --ff-only
git log --oneline -3                              # squash コミット <sha> を確認
git switch -c revert/ddd-clean-architecture
git revert --no-edit <sha>                        # squash なので 1 コミットの revert で全体が戻る
(cd deep-spec-analysis && bunx tsc --noEmit && bun scripts/build-tools.ts --check && bun test --coverage)
git push -u origin revert/ddd-clean-architecture
gh pr create --base main --title "revert: ..." --body "Reverts #<N>. 理由: ..."
```

- オーナーが squash-merge する（承認の形は本体と同じ）
- revert 後は `docs/decisions.md`／`.ja.md` の該当節に「revert された。理由と再挑戦の条件」を追記する（節は消さない。決定記録は追記のみ）
- AI-DLC レコードと監査シャードは戻さない。revert の経緯は新しい Intent か、この Intent の監査シャードへの追記で残す

### R3. タグを切った後に見つかった場合（リポジトリ側）

1. タグは削除も付け替えもしない（利用側の `--tag` 固定と CI の `--check-tag` が壊れる）
2. R2 の revert PR を `main` に入れる
3. `bun deep-spec-analysis/scripts/release.ts <次のパッチ版>` で新しいタグを切る（例: `v0.5.1` に不具合なら `v0.5.2`）。最新安定タグを解決する利用側は次回の `--update` で自動的にそちらを掴む

### R4. 利用プロジェクト側

```bash
# 前の版に固定して更新（導入先の記録 <harness>/tools/data/deep-spec-analysis-install.json が更新される）
bun deep-spec-analysis/scripts/install.ts --project <project> --tag v0.5.0 --update
# 確認
bun <checkout>/aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install <project> --harness <harness>
```

- `--update` は同じ導入先を再取得して差し替える。固定タグを指定すれば `Changed 0` になるまで冪等
- 利用側の `aidlc/` レコードや `memory/` は installer が触らないので、戻しても失われない

## 戻さないもの

- `deep-spec-analysis/docs/decisions.md`／`.ja.md` の裁定記録（追記のみ。revert したことを追記する）
- `aidlc/spaces/default/memory/project.md` に永続化した学習（裁定の内容は revert の有無と独立）
- 監査シャード（append-only）
- `aidlc-workflows/` submodule（この Intent で動かしていないので戻す対象が無い）

## 検証

revert を `main` に入れたあと、本体と同じ検証を通す。

- `bunx tsc --noEmit` 0、`bun scripts/build-tools.ts --check` 同期、`bun test --coverage` 0 fail（`bunfig.toml` の床 0.9）
- `aidlc-plugin-validate` Errors 0、7 harness build OK
- サンドボックスへ `--from <checkout>` で導入し `aidlc-plugin-test` が CLEAN
- 外部仕様の逸脱が引き金だった場合は、該当 golden（`tests/fixtures/*/expected/*.json`）が byte 一致すること

## 連絡と承認

- 判断と承認: リポジトリオーナー（GitHub `j5ik2o`、連絡は PR か issue のコメント）。revert PR のマージも本体と同じくオーナーが行う
- 私（AI-DLC のセッション）は R1〜R2 の手順実行、検証、記録の追記までを担う
- 本家の不具合が原因なら、awslabs/aidlc-workflows へは別途 issue で出す（このリポジトリ内の追跡は #138）
