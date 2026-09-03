<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-03T06:31:12Z — 初回スキャンは deep-spec-analysis/ に絞った focused scan（kind: partial）とする; NO_STORE なので質問は不要。aidlc-workflows/（submodule）・.claude/・docs/・sandbox は intent の対象外で、全走査はコストに見合わない。dist/ と node_modules/ は生成物なので深掘りしない。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-03T06:48:05Z — timestamp の Scope of Analysis は kind: partial・入れ子の analyzed.paths・fingerprint は mint の出力（unknown）で書く; テンプレートは「計算できないときは unknown」を認めており、kind: full は全体を深く読んだときだけ許される。このワークスペースの fingerprint ツールはトップレベル項目しか受け付けない（docs/ は通り、deep-spec-analysis/tools/ 等は unknown）ため、公開時に候補の fingerprint 検証（CODEKB_CANDIDATE_STALE）に当たる可能性があり、その場合はゲートで人に諮る。
- 2026-09-03T06:32:16Z — スナップショットの paths は ./ にした; codekb-snapshot は deep-spec-analysis/ で始まる repo 相対パスを fingerprint できない（切り分け: docs・README.md・./ は通り、aidlc/spaces・.claude/tools・deep-spec-analysis/docs など `/` を含む入れ子パスはすべて失敗する。fingerprint がトップレベル項目しか受け付けない）。focused scan の解析範囲は developer の Scan Coverage と timestamp の analyzed.paths で記録し、fingerprint だけ全体で取る（保守的: どこが変わっても STALE 判定になる）。
- 2026-09-03T06:31:12Z — intent 登録の repos を ["aidlc-workflows"] から [] に修正; sibling 自動検出が git submodule（フレームワーク本体）を解析対象に登録していたが、この intent の対象はルートリポジトリ内の deep-spec-analysis/ なので、ワークスペースルートを未登録の単一リポジトリとして扱う。intents.json を直接編集した（repos を変える verb が無いため）。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
