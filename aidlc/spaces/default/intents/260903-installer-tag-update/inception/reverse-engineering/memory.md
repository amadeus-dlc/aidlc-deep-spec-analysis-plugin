<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-03T13:04:17Z — intents.json の repos が [] なので、この Reverse Engineering はワークスペースルート 1 repo（未登録の project-root repo）として 1 回だけ走らせ、handoff と link receipt に --repo を付けない; codekb-path は aidlc/spaces/default/codekb/deep-spec-analysis/ を返した。codekb-scope-diff の判定は UNVERIFIED（前 intent src-bundle-split の store が fingerprint: unknown を記録）なので、stage の規則どおり Reuse 選択肢を出さず Full rescan／Focused scan の 2 択を人間に提示する。store の analyzed.paths は deep-spec-analysis/tools/ をソース木として記録しているが、前 intent の code-generation で tools/ は src/ へ移設済み（project.md の学習）なので、その事実も判断材料として提示する
- 2026-09-03T13:15:14Z — 人間は Full rescan を選択。この選択の意味は「9 成果物をすべて置き換え、scope block はこの run だけから組む」であり、深く読む範囲はチームの既定（project.md の学習）どおりプラグイン本体 deep-spec-analysis/ に限り、aidlc-workflows/ submodule・.claude/・sandbox・dist/・node_modules/ は対象外のまま。ワークスペース全体を深く読むわけではないので Scope of Analysis は kind: partial（./ は analyzed.paths に入れない）とし、codekb-snapshot／codekb-publish の paths だけ ./ にする（fingerprint ツールが入れ子パスを扱えないため、これも project.md の学習どおり）
- 2026-09-03T13:57:09Z — 再開後の人間の選択は Focused scan であり、同じ stage attempt 内に残っていた上記 Full rescan の選択を置き換える。既存 store は UNVERIFIED なので本文は履歴知識として保持し、今回確認した installer 周辺だけを analyzed に記録し、旧 verified scope は shallow へ降格した。snapshot 後に人間が追加した未追跡の .agents/ と AGENTS.md は解析対象外であり、fresh snapshot の store_generation と source_fingerprint は元 snapshot と一致したため、developer handoff を維持して architect synthesis と CAS publish をやり直した

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-03T13:57:09Z — Focused scan を選んだ結果、既存本文を失わず intent に必要な installer／update／release 経路を短時間で再検証できた一方、fingerprint の無い旧 store が深く分析済みとしていた tools／tests／scripts 等の9 pathsと12 componentsは NARROWER 判定で shallow へ降格した。降格は知識の削除ではなく検証状態の変更であり、広い verified coverage が必要になった時点で full rescan を行う

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
