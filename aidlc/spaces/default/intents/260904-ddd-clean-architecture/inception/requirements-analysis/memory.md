<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations

- 2026-09-04T01:25:19Z — 外部仕様は本家互換を必須とし、契約1〜4、golden bytes、findings JSON、stdout verdict、文言、正準順、solver pinを原則変更しない。避けられない変更は一括承認ではなく、変更項目ごとに実装前の人間裁定を得る。
- 2026-09-04T02:49:19Z — Functional Design の検証で実測したゼロ Unit 経路の不整合修正は、ユーザーの「別Intentしないで含めて」という指示に従い、`deep-spec-analysis/` の設計改善と同じ Intent で扱う。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
