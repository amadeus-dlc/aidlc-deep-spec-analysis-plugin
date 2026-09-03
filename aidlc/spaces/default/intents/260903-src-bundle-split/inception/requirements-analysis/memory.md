<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-03T07:20:27Z — doctor の installed 行のラベル変更（.ts → .js）は外部仕様の変更だが、intent の記述 (4) が明示しているので裁定済みとして要件に載せ、質問にはしない。
- 2026-09-03T07:20:27Z — 確認事項は 4 問に絞った; intent の記述が設計判断（パッケージ構成・bundle 単位・生成物コミット・drift guard・規則の走査先）を前出ししており、codekb のリスク 9 項目のうち記述だけでは決まらない 4 点（旧 .ts の孤児化、spawn テストの対象、sourcemap、相対 import の穴）だけを訊いた。Minimal 深度の範囲内。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
