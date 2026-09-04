<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-04T14:39:41Z — stage 本文の DB migration・依存サービスの健全性は該当なし（配布物は git のタグで、実行環境を持たない）; health check は PR のチェック状態・pr-review-clean の verdict・サンドボックスの doctor に読み替えた。
- 2026-09-04T14:39:41Z — この段階の「デプロイ実行」は PR の作成と検証までと読んだ; main へのマージはオーナーの手動承認（前段 Q3=A）なので、完了条件は「PR が open、3 チェック SUCCESS、未解決スレッド 0、PR ブランチからのサンドボックス導入が CLEAN」とし、マージ後の smoke はオーナーのマージ後にこの記録の手順で行う。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-04T14:39:41Z — 上流の環境インベントリ（environment-provisioning）は scope で SKIP; 対象環境は cd-config の昇格段階（PR → main → タグ → 利用側）から採り、捏造していない。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-04T14:39:41Z — Q2 は監査行を同じ PR へ追いコミットする案（A）; 既存パターンの追いの chore PR（#135・#137）より同梱規律に忠実で、マージがオーナーの手動なので追いコミットの余地がある。オーナーが追いコミット前にマージした場合は既存パターンに落とす。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
