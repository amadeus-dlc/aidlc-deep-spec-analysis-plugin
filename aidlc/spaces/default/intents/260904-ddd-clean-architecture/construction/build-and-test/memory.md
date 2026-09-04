<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-04T13:19:06Z — Test Strategy が Minimal なので stage 本文は integration／performance／security の指示ファイルを「生成しない」と言うが、この stage の produces 契約には 3 ファイルとも列挙されている。空の placeholder ではなく、「なぜ新規生成しないか」と「既存のどの検証がその境界を覆っているか（再実行コマンドつき）」を記録する短い文書として作った。required-sections（H2 2 つ以上）と upstream-coverage（consumes 3 件への言及）はこの形で満たす。
- 2026-09-04T13:19:06Z — 測定可能な品質目標の一覧は、NFR Requirements／NFR Design が SKIP のため、code-generation-plan.md の Quality Targets と Testing Contract（strategy_volume・scope_floor）、bunfig.toml のカバレッジ床、tests/build-tools.test.ts の bundle 上限、t68 の version 3 点整合から組み立てた。reviewer の R-02（lint の実走）は、deep-spec-analysis に lint が無い（CI にも無い）ので N/A として理由を書き、aidlc-workflows 側は `bun run lint` の実走で Met にする。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-04T13:58:00Z — aidlc-workflows の全体スイートは `Result: FAIL`（HEAD 基線と同じ環境要因 6 ファイル）なので、失敗の梯子を踏んだ。Rung 1 は 2 回（グローバル git 設定の無効化→効果なし、`git check-ignore -v` で `~/.config/git/ignore` の `vendor/` を特定して `XDG_CONFIG_HOME` を隔離→`t255`・`t314` が緑）、Rung 2 で残り 4 ファイル（AWS 認証・300 秒超・cursor adapter・plugin selection）を生成コード外の環境要因と分類、Rung 4 で候補 fix 無しの halt-and-ask を提示した。目標 T-BT-10 は定義どおり Met（基線と一致・新規失敗 0）だが、コマンド全体の FAIL を Met に読み替えて手順を飛ばすことはしない。
- 2026-09-04T14:05:00Z — オーナー裁定（2 度目の指示）: `aidlc-workflows/` は開発対象ではなく、変更してはならない。要件 FR8（Q5=A）が core の改変を含めていたが、この裁定が優先する。aidlc-workflows の作業ツリー変更（core 6 ファイル、回帰試験、dist 7 harness、version 2.7.2、README、CHANGELOG）をすべて HEAD へ戻し、差分はパッチとして退避した。派生の `.claude/tools/` 同期も戻した。`.codex/tools/` の 2 ファイルはこのセッション開始前から変更されていた（前セッションの導入コピー同期）ので、扱いはオーナーに確認する。FR8 の実装はこの Intent では成立しない扱いになり、成果物（code-summary・traceability・source-manifest・test-results・decisions の Evidence）から aidlc-workflows の主張を外す。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-04T13:19:06Z — aidlc-workflows の全体スイート（約 1 時間）を、Code Generation 末尾の同一ツリーでの実行ログ（11:37Z）を引用するだけで済ませず、この stage で改めて実行した。core とテストの更新時刻がそのログより前であることは実測していたが、Build and Test の証跡は「この stage が走らせた」ものであるべきで、1 時間の待ちはバックグラウンド実行で他の成果物作成と重ねて吸収した。
- 2026-09-04T13:19:06Z — `unit-test-instructions.md` の波ごとのスコープ付きコマンドは、全体実行の部分集合と分かっていても各 1 回ずつ実行した（Wave 3 だけは Wave 4／5 のコマンドに包含されるため重複させない）。stage の「同一コマンドは 1 回」の規則を守りつつ、指示ファイルどおりに走ることの証明を残すため。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-04T13:55:00Z — aidlc-workflows の基線から赤い `t255`・`t314` の「`git submodule add … vendor/sub failed: The following paths are ignored by one of your .gitignore files`」は、この機械の XDG 既定のグローバル ignore（`~/.config/git/ignore:29` の `vendor/`）が原因だと `git check-ignore -v` で特定した。`GIT_CONFIG_GLOBAL=/dev/null` では外れない（設定値ではなく既定の excludes ファイルのため）。テスト側が `XDG_CONFIG_HOME` を隔離していないので、`vendor/` を無視する開発者環境では基線から赤になる。aidlc-workflows 側の後続候補（テストランナーで `XDG_CONFIG_HOME` を空ディレクトリへ向ける）。
