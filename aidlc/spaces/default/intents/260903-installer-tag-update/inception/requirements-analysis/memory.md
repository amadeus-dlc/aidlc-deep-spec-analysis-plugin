<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-03T14:17:41Z — `--update` は取得元の意味を維持する。local は同じ path、ref は同じ branch、固定 tag は no-op、latest は最新 stable tag と解釈し、同一 version でも mutable source の payload hash が変われば更新対象とした

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-03T14:17:41Z — `--from` は repo root と plugin root の両対応ではなく、`deep-spec-analysis/` を含む repo root だけを受け付ける。利用者の path 指定は厳しくなるが、source layout の自動判定をなくして取得経路を一意にした
- 2026-09-03T14:17:41Z — `payload_sha256` は archive や build 前 source ではなく compose 後の plugin-owned payload から算出する。source 同一性よりも実際の導入結果の完全性を検証し、来歴 JSON 自身は循環参照を避けるため除外する

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
