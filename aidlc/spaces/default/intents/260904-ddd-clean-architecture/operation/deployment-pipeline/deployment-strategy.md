# Deployment Strategy — DDD／クリーンアーキテクチャ改善

## 配布モデル

このプラグインは稼働中のサービスではなく、利用プロジェクトが `deep-spec-analysis/scripts/install.ts` で **不変のタグ** を引く pull 型の配布物です（`--tag <tag>` で固定、指定なしなら最新の安定 SemVer タグ、`--update` で同じ導入先を更新）。したがって blue/green・canary・rolling のような稼働中トラフィックの切り替えは存在しません。それに相当するものは次の 2 つです。

- **配布前の実射**: 変更前 A／変更後 B／A→update を別々のサンドボックスへ導入し、同じ intent に 10 entry を発火して byte 比較する（Code Generation で実施済み、[`code-summary.md`](../../construction/code-generation/code-summary.md)）
- **利用側の固定**: 利用プロジェクトはタグを固定でき、更新は利用側の判断で行う。壊れた版を掴んだ利用側は前のタグへ戻せる（[`rollback-runbook.md`](./rollback-runbook.md)）

## 戦略の選択

| 候補 | 判定 | 理由 |
|---|---|---|
| blue/green・canary・rolling | 該当なし | 稼働環境もトラフィックも無い |
| PR ゲート＋squash-merge、タグなし（採用） | 採用 | 外部仕様が byte 不変なので、`main` への取り込みだけで目的を達する。利用側の挙動は変わらず、タグを切っても更新して得るものが無い（Q1=A） |
| PR ゲート＋パッチタグ `v0.5.1` | 不採用（後から可能） | 手順は `release.ts 0.5.1` の 1 コマンドで、必要になった時点で切れる |

採用した流れは [`cd-config.md`](./cd-config.md) の 8 段（0〜7）。ここで担保するのは、(1) `main` に入るのは検証済みの内容だけ、(2) `aidlc-workflows/` submodule を動かさない、(3) 監査シャードが同じ PR に載る、の 3 点です。

## 環境昇格ゲート

| 段階 | 入る条件 | 誰が |
|---|---|---|
| 作業ツリー → PR | tsc 0、`build-tools --check` 同期、`bun test --coverage` 0 fail、validate Errors 0、7 harness build OK、`.codex/tools/` を HEAD へ、submodule 無変更、監査シャード同梱 | 私 |
| PR → `main` | `ci`・CodeRabbit・Devin Review が SUCCESS、未解決レビュースレッド 0（`pr-review-clean` で確認） | 私が整え、オーナーが squash-merge |
| `main` → タグ | 今回なし。切るときは `release.ts <version>` が manifest 更新・`chore(release): publish v<version>` コミット・タグ・`git push --atomic origin main v<version>` を一括で行い、CI の `--check-tag` が manifest と突き合わせる | オーナー |
| タグ → 利用プロジェクト | 利用側が `install.ts --tag` または `--update` で引く | 利用側 |

## 承認ワークフロー

- `main` に branch protection は無いが、承認は **オーナーの手動 squash-merge** で行う（Q3=A、`org.md` の「本番は別の手動承認でゲート」）
- 私は PR 作成、チェックの green 化、レビュー指摘の解決までを担い、マージ操作はしない
- auto-merge は有効化しない（リポジトリ設定の変更を伴い、手動承認を外すことになる）

## リリース方針と版数

- 今回はタグを切らない（Q1=A）。次に外部に見える変更（機能追加・修正）を出すときに、この内容も含めて 1 つのタグにまとめる
- 版数は SemVer。内部リファクタだけならパッチ、契約や公開ファイルに見える追加はマイナー。タグは `v<stable-semver>` で、`.aidlc-plugin/plugin.json` の `version` と一致しなければ CI が落ちる
- タグは不変。誤ったタグを付けた場合も削除・付け替えはせず、次の版で直す

## Feature flag

該当なし。プラグインに実行時の flag 機構は無く、この Intent の変更は挙動を変えない（`AIDLC_DEEP_SPEC_QUINT_METHOD` は検証方式の環境変数で、この変更とは無関係）。

## リスクと緩和

| リスク | 緩和 |
|---|---|
| CI の quint 実行が負荷で flake する（EAGAIN／OOM は `failed` として検出される設計） | `gh run rerun` で再実行。同一コミットで赤→緑になったら `test-results.md` の記録と突き合わせる |
| PR 作成後にゲート承認・学習の永続化で監査シャードに行が増える | 既存パターン（#135、#137）どおり追いの chore PR。`main` へ直接 push しない |
| `aidlc-workflows` の gitlink が誤って動く | 段 0 と PR の Files で `aidlc-workflows` が差分に無いことを確認する |
| codekb（Reverse Engineering の出力）と本体の乖離 | codekb の変更は同じ PR に載せ、レビューで本体と突き合わせる |
| 利用側が `--ref main` で未タグの `main` を掴む | README が `--ref` を非再現的として非推奨にしている。問い合わせがあればタグ固定へ誘導する |
