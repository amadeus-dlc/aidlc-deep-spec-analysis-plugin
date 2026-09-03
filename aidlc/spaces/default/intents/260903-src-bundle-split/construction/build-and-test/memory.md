<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-03T10:19:48Z — Minimal 戦略だが結合／性能／セキュリティの指示ファイルを 3 本書いた; ステージ本文の「Minimal は追加のテスト指示を作らない」に対する逸脱ではなく、同本文の「context が求めれば追加してよい」に依る。既存の結合テスト群の対象が今回 spawn 先ごと出荷物へ移ったこと、配布モデルの変更が供給網の観点を変えたこと、NFR3／NFR4 が測定可能な目標であることが理由。新しいテストスイートは 1 本も足していない（既存が何を繋いでいるかを書いただけ）。
- 2026-09-03T10:19:48Z — NFR3-c（CI 総所要）は上界で Met と判定した; CI の実測は GitHub Actions の実行が要るのでこのワークフローからは取れない。ci.yml への追加は build-tools --check の 1 ステップだけ（ローカル実測 0.12 秒）で既存ステップは増減なし、2 倍という目標に桁で余裕があるため。Unverified ではなく判定根拠つきの Met とし、次回 CI 実行での確認を積み残しに書いた。
- 2026-09-03T10:19:48Z — FR6.2 の owning stage を code-generation から build-and-test へ移した; code-generation の traceability.json では「実装ファイルに対応しない検証活動」として N/A だったが、本ステージで実サンドボックスの再導入と実射を実行して充足を確認した。完了済みステージの成果物は書き換えず、cross-unit-traceability.md に移管の理由ごと記録した。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
