# Requirements Analysis — 確認事項

intent の記述（`project-description.json`）で設計判断の大半は前出しされているので、ここではコード知識ベース（`codekb/deep-spec-analysis/code-quality-assessment.md` のリスク 9 項目）から、記述だけでは決まらない 4 点だけを訊きます。

## Q1. 既存インストール先に残る旧 `.ts` の扱い（アップグレード経路）

現状の installer（`scripts/install.ts`）の refresh／tombstone はファイル単位・非再帰です。`tools/` が `.js` bundle 10 本＋`data/` になると、プラグインを既に導入済みのプロジェクトには旧 entry `tools/aidlc-sensor-*.ts` 10 本と層ディレクトリ `tools/<ctx>/**` の `.ts` 468 本が孤児として残ります（実測に基づくリスク 5）。アップグレード時にどう扱いますか？

A. installer の tombstone をディレクトリ単位（再帰削除）に拡張し、旧 entry `.ts` 10 本と 6 コンテキストのディレクトリを削除する（推奨。intent-e2e の tombstone 検査を拡張して回帰網にする）
B. 旧ファイルは残す（孤児は無害と割り切り、手動削除に任せる）
C. 旧 entry `.ts` 10 本だけ削除し、層ディレクトリは残す
X. Other (please specify)

[Answer]: A

## Q2. entry を spawn するテスト群の実行対象

conformance（golden byte 比較）・parity（spawn 出力スナップショット）・各 pipeline テスト・intent-e2e は、entry をパス文字列で spawn します（テスト経路 2・4）。src/ 分離後、これらは何を spawn すべきですか？

A. 出荷物の `tools/*.js` bundle を spawn する（出荷物そのものを golden で検証する。drift guard と並ぶ受け入れ条件になる。推奨）
B. `src/entries/*.ts` を spawn する（ソースを直接実行。bundle は drift guard だけで守る）
C. 両方を spawn する（二重に検証。テスト時間は約 2 倍）
X. Other (please specify)

[Answer]: A

## Q3. bundle に付随させる sourcemap

bundle は minify しないため関数名やファイル境界コメントは残ります（実測: verify-smt 158 KB / 4,957 行）。現場でのデバッグ用に sourcemap を同梱しますか？ 同梱すれば projection でも利用先へ運ばれます。

A. 同梱しない（まずは bundle のみ。必要になったら足す。推奨）
B. 外部 sourcemap（`tools/*.js.map`）を同梱する
C. inline sourcemap（bundle 自体に埋め込む。サイズが増える）
X. Other (please specify)

[Answer]: A

## Q4. パッケージ境界を素通りする相対 import の扱い

実測（スパイク）では、bun workspaces ＋ isolated linker ＋ `exports` は bare specifier（`@deep-spec/<ctx>-<layer>`）の宣言外 import と深い import を実行時・型検査時に止めますが、`../` で隣のパッケージへ逃げる相対 import は止められません（リスク 1）。「宣言外の層を解決不能にする」を完成させるには規則の追加が要ります。

A. 規則で禁止する: 層またぎ・コンテキストまたぎの import は必ず bare specifier にし、パッケージディレクトリの外へ出る `../` は `tests/architecture/rules.ts` の規則で違反にする（推奨）
B. 禁止しない（既存の `layer-direction` 規則によるテスト時検出に任せる）
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

回答のまとめ:

- Q1 旧 `.ts` の扱い: **A** — installer の tombstone をディレクトリ単位（再帰削除）に拡張し、旧 entry `tools/aidlc-sensor-*.ts` 10 本と 6 コンテキストの層ディレクトリを削除する。intent-e2e の tombstone 検査を拡張して回帰網にする
- Q2 spawn テストの対象: **A** — conformance／parity／pipeline／intent-e2e は出荷物の `tools/*.js` bundle を spawn し、golden の byte 一致を出荷物そのもので検証する（drift guard と並ぶ受け入れ条件）
- Q3 sourcemap: **A** — 同梱しない（bundle は非 minify。必要になったら足す）
- Q4 相対 import の穴: **A** — 層またぎ・コンテキストまたぎの import は必ず bare specifier（`@deep-spec/<ctx>-<layer>`）とし、パッケージディレクトリの外へ出る `../` は `tests/architecture/rules.ts` の規則で違反にする

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
