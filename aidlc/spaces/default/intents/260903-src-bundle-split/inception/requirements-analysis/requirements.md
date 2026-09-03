# 要件定義 — tools/ を出荷物（bundle）と src/ に分離し、レイヤー依存をパッケージ境界で強制する

## Sources

- `[desc]` Initial description: `aidlc/spaces/default/intents/260903-src-bundle-split/project-description.json`（`bun .claude/tools/aidlc-utility.ts project-description` の返す原文。設計判断 (1)〜(6) を前出し）
- `[scope]` Workflow-selected scope: express（Depth Minimal、Test Strategy Minimal）
- コード知識ベース（Reverse Engineering の成果物、`aidlc/spaces/default/codekb/deep-spec-analysis/`）: `business-overview.md`（プラグインの目的・4 契約・配布先と縮退の約束）、`architecture.md`（6 コンテキスト × 層、依存方向、Interaction Diagrams の「projection ビルド → install → compose」経路、Improvement Opportunities 1〜6）、`code-structure.md`（`tools/` の物理構成、entry の役割、命名・配置規則）、`code-quality-assessment.md`（技術的負債 14 項目、本 intent のリスク 9 項目、テストが `tools/` に到達する 7 経路）、`dependencies.md`（層間依存表、facade 非経由の直接 import 23 本）
- `[Q1]`〜`[Q4]` 確認事項の回答: `requirements-analysis-questions.md`（すべて A）

## 意図の分析

このプラグインは AI-DLC のセンサーとして利用先の `.claude/tools/` に **逐語コピー**され、`bun .claude/tools/<entry>` が相対 import だけで動く（`business-overview.md` の配布先、`architecture.md` の経路図 2）。そのため `tools/` は「開発のためのソース」と「配布のための出荷物」を兼ねており、6 コンテキスト × 層は素のディレクトリでしかなく、依存方向は `tests/architecture/rules.ts` の `layer-direction` 規則がテスト実行時に検出するだけである（`code-structure.md`「命名と配置の規則」）。

達成したいこと（機能ではなく目的）:

1. **依存方向を構造で強制する** — 宣言していない層は import が解決できず、IDE・型検査・実行時のいずれでも即座に分かる状態にする。テスト時検出は残すが、唯一の防衛線ではなくす
2. **出荷物と配布経路を変えない** — upstream の projection／validate／compose と `scripts/install.ts` の流れ、利用先での実行形（`bun .claude/tools/<entry>`、node_modules 不要）はそのまま。出荷物は entry ごとの bundle になる
3. **外部仕様と決定論を守る** — IR・findings JSON・doctor 出力・verdict 行の項目と文言、golden の byte 一致は不変
4. **本来のソースは読める TS のまま** — `src/` が唯一の編集対象で、`tools/` はそこから機械的に生成される成果物になる

種別: リファクタリング（ビルド・配布モデルの変更）。範囲: `deep-spec-analysis/` 全体（tools／tests／scripts／sensors／stages／docs／設定）。複雑さ: standard だが設計判断は前出し済み。

## 機能要件

### FR1. `src/` をレイヤー単位の workspace パッケージにする

- **FR1.1** `src/<ctx>/<layer>/package.json` を 17 層すべてに置く。`name` は `@deep-spec/<ctx>-<layer>`（例 `@deep-spec/kernel-domain`）、`private: true`、`exports` は `"."` → `./index.ts` のみ（深い import は解決不能）
- **FR1.2** 各パッケージの `dependencies` は許可される層だけを `workspace:*` で宣言する。許可辺は現行の `ALLOWED_LAYER_TARGETS`（infrastructure ← domain ← usecase ← adapter）、同一コンテキスト内と `kernel`、および `SANCTIONED_CROSS_CONTEXT` の 4 辺（`refinement/domain → requirements/domain`、`refinement/domain → design/domain`、`design/usecase → refinement/domain`、`design/adapter → refinement/domain`）と一致させる。宣言表と `rules.ts` の許可表は同じ事実を指し、片方だけを変えられないことをテストで固定する
- **FR1.3** root `package.json` に `workspaces` を宣言し、`bunfig.toml` の `[install]` を `linker = "isolated"` にする。`bun install` 後、宣言外の `@deep-spec/*` は実行時にも `bunx tsc --noEmit` でも解決できない（受け入れ: red example のテストで固定）
- **FR1.4** entry（センサー 9 本＋doctor）は `src/entries/` に置き、workspace メンバー（例 `@deep-spec/entries`）として自分が配線する層だけを依存宣言する。`tests/` と `scripts/` は root の `dependencies`（または workspace）経由で `@deep-spec/*` を解決できる（`code-quality-assessment.md` リスク 2）
- **FR1.5** `[Q4]` 層またぎ・コンテキストまたぎの import はすべて bare specifier（`@deep-spec/<ctx>-<layer>`）にする。パッケージディレクトリの外へ出る相対 import（`../` でパッケージ境界を越えるもの）は `tests/architecture/rules.ts` の規則で違反にする（red／green example つき）。facade 非経由の直接 import 23 本（`dependencies.md`）はこの置き換えで解消される
- **FR1.6** 同一パッケージ内の import は相対パスのまま。`index.ts` facade の再輸出台帳は現状どおり（`export *` 禁止）

### FR2. `tools/` は出荷物（bundle）だけを置く

- **FR2.1** `tools/` の内容は **bundle 10 本（センサー 9＋doctor）と `data/`（契約スキーマ 4 本）だけ**。層ディレクトリは置かない。bundle のファイル名は `<entry>.ts` を保つ（2026-09-03 オーナー裁定。理由は FR4.1 参照）
- **FR2.2** bundle は entry ごとに 1 本、`bun build --target=bun --external z3-solver`、code splitting なし、minify なし、`[Q3]` sourcemap なし（`--sourcemap=none`）
- **FR2.3** bundle は自分のディレクトリの隣の `data/` からスキーマを解決する（`import.meta.url` 相対。現行 entry の挙動を維持。スパイク実測で bundle でも成立）
- **FR2.4** SMT entry の `--smt-child` 自己再起動、design 系 entry から兄弟 entry の spawn、doctor から refcheck entry の spawn は出荷物のパス（`tools/<entry>.ts`）で行う。`architecture.md` Data Flow 1〜4 の経路は不変

### FR3. 生成器と drift guard

- **FR3.1** `scripts/build-tools.ts`（名称は実装で決めてよい）が `src/entries/*.ts` から `tools/<entry>.ts`（中身は bundle 済み JS）を生成し、`data/` を同期する。`--check` を付けると一時ディレクトリに再生成してコミット済み `tools/` と比較し、差分があれば非ゼロで終了して差分ファイル名を出す
- **FR3.2** `tools/` は生成物として git にコミットする。CI は `--check` を実行し、`bun test` にも `--check` 相当のテスト（または同等の assert）を 1 本含める。upstream の `aidlc-runner-gen check` と同じ「生成し直して差分ゼロ」の型
- **FR3.3** 同じソースと同じ bun（`mise.toml`／CI の 1.3.13）からは byte 同一の bundle が出ること（NFR1）。絶対パスや時刻を bundle に埋め込まない

### FR4. 配布経路の追随（`.ts` 固定パスの置き換え）

- **FR4.1** `sensors/*.md` 9 本の `command` は `bun {{HARNESS_DIR}}/tools/<entry>.ts` のまま**変えない**。2026-09-03 オーナー裁定: 当初は `.js` にすると決めていたが、上流のディスパッチャ `aidlc-workflows/core/tools/aidlc-sensor.ts` の `resolveScriptPath` が command から `.ts` で終わるトークンを探して無ければ `dispatchError` で落ち、`aidlc-utility.ts` の doctor チェックも `<plugin>-doctor.ts` を決め打ちしている。配布経路（projection／validate／compose）は拡張子非依存だが実行経路は `.ts` を要求するため、「upstream の契約は変えない」制約と両立するのは出荷物のファイル名を `.ts` に保つこと。中身が bundle 済み JS でも bun と node（型ストリップ）はどちらも実行でき、findings JSON・verdict 行が `.js` 名と byte 同一で golden にも一致することを実測済み
- **FR4.2** doctor の installation manifest（`installation-manifest.ts`）は entry `.ts` 10 本＋`data/` 4 本＋sensors／knowledge を列挙し、`index.ts` canary 17 本は削除する。entry 行のラベルは FR4.1 の裁定により**変わらない**。層が配布されなくなるため canary 17 行が消えることだけが外部仕様の変更で、これは intent の目的そのものの帰結（`[desc]` (4) の裁定の範囲）。これ以外の doctor 出力は不変
- **FR4.3** entry 内・adapter 内の兄弟 tool 名（`sibling-backend-client-impl.ts`、design-verify-smt entry の `childHostPath`、`doctor-workspace-client-impl.ts` の refcheck tool 名）は `.ts` のまま（FR4.1 の裁定）。出荷物の名前を層が持たないよう、可能なものは entry が注入する（`process-only-in-entries` の流儀）
- **FR4.4** `stages/construction/deep-spec-analysis-functional-verify.md` のコマンド例、`README.md`／`README.ja.md` の構成表、`tests/README*.md`、`scripts/smt-stress.ts`、knowledge の参照を新しいパスと構成に合わせる（`data/` を参照する箇所は不変）
- **FR4.5** `[Q1]` `scripts/install.ts` の tombstone をディレクトリ単位（`rmSync(..., { recursive: true })`）に拡張し、アップグレード時に `tools/{kernel,requirements,design,refinement,refcheck,doctor}/` を利用先から削除する。旧 entry 10 本はファイル名が変わらないため既存の upgrade refresh が置き換える（FR4.1 の裁定の副産物）。`tests/intent-e2e.test.ts` の tombstone 検査を拡張し、旧構成を植えた導入先が再導入で bundle＋`data/` だけになることを固定する

### FR5. テストとアーキテクチャゲートの移行

- **FR5.1** in-process のテスト（17 ファイル＋`tests/doubles/` 2 本）は `@deep-spec/<ctx>-<layer>` の facade から import する
- **FR5.2** `[Q2]` entry を spawn するテスト（`conformance`、`parity/snapshot.ts`、`refinement-pipeline`、`refcheck`、`ir-validation`、`design-verify`、`refinement`）は **`tools/` の出荷物 bundle** を spawn する（`src/entries/` のソースではない）。golden（`tests/fixtures/*/expected/*.json`）と parity スナップショットは byte 同一のまま緑
- **FR5.3** `tests/architecture.test.ts` と `rules.ts` は `src/` を走査する: `locationOf` は `src/<ctx>/<layer>/...` と `src/entries/<name>.ts` を分類し、`only-sanctioned-imports` は `@deep-spec/*` を許してパッケージ名から層を読み、`layer-direction` は bare specifier の辺で方向を判定し、FR1.5 の「パッケージの外へ出る相対 import」規則を加える。走査は `node_modules` と symlink（isolated linker が各パッケージ直下に作る）を除外する。既存 18 規則（`no-data-models-in-domain`、`domain-fields-are-private`、`published-language-layers` 等）はすべて維持し、`PUBLISHED_LANGUAGE` 表の鍵を `src/` のパスに更新する。`tools/` の出荷物は規則の走査対象に入れない
- **FR5.4** `bunfig.toml` の `coveragePathIgnorePatterns` と `tsconfig.json` の `include` を `src/` 起点に書き換える。domain 層の床 0.9（行・関数）は不変。存在しない除外 2 件（`tools/deep-spec-lib.ts`、`tools/deep-spec-refinement-lib.ts`）と `rules.ts` の古い LEGACY コメントは除去する
- **FR5.5** `tests/doctor-domain.test.ts` の manifest 期待値、`intent-e2e` の compose 検査リスト（entry 3 本＋canary 17 本）を新構成（bundle＋`data/`）に合わせる

### FR6. 出荷物の検証

- **FR6.1** `bunx tsc --noEmit`、`bun test --coverage`（既存 480 テストが緑、床 0.9 維持）、`aidlc-plugin-validate` が VALID、7 ハーネスの `aidlc-plugin-build` が成功
- **FR6.2** 実サンドボックス（`deep-spec-analysis-sandbox/`）に installer で再導入し、`.claude/tools/` が bundle 10 本＋`data/` の 14 ファイルだけになる（旧の層ディレクトリ 6 本が消え、entry は同名のまま bundle に置き換わる）こと、実ディスパッチャ経由の実射（`260829-feature` で ir-valid pass／SMT findings 5／Quint findings 2、doctor の checks が全 pass）が 2.7.1 検証時の結果と一致することを確認する

### FR7. 記録

- **FR7.1** `docs/decisions.md`／`decisions.ja.md` に「tools/ は生成物、src/ がソース」への配布モデル変更を段落として記録する（同 PR 表記、PR 番号なし）
- **FR7.2** チームナレッジ `aidlc/spaces/default/knowledge/aidlc-shared/aidlc-engine-operations.md` の「インストール先の後入れアップグレード」節と `README.md` の構成表を新しい出荷形に更新する

## 非機能要件

- **NFR1 決定論（ビルド）**: 同一ソース・同一 bun 版から生成した bundle は byte 同一である。判定は `scripts/build-tools.ts --check` が差分ゼロで exit 0 を返すこと（FR3 の前提）
- **NFR2 外部仕様の不変**: IR・findings JSON・cross-check・refcheck レポート・doctor 出力の項目と文言、verdict 行、exit code の意味は変えない（例外は FR4.2 の canary 17 行の消滅のみ。entry のファイル名は FR4.1 の裁定により不変）。判定は golden 4 種と parity スナップショットが byte 同一のまま緑であること
- **NFR3 実行時間**: ローカルの `bun test --coverage` は 60 秒以内（現状 27 秒）、`scripts/build-tools.ts` の全 bundle 生成は 10 秒以内（スパイク実測: 158 モジュールを 6 ms）。CI の総所要は現状（約 1〜2 分）の 2 倍以内
- **NFR4 出荷物の大きさ**: bundle 1 本は 512 KiB 以下。`tools/` の総ファイル数は 14（bundle 10＋data 4）。当初は「300 KB 以下（実測 50〜160 KB）」としていたが、その実測は requirements 系 entry だけを見たもので、241 モジュールを束ねる design 系 3 本（291〜300 KB、最大 `design-verify-smt.js` = 300,189 バイト）を織り込んでいなかった。上限が実質ゼロ余裕になり 189 バイトで落ちる脆いゲートになるため、2026-09-03 のオーナー裁定で 512 KiB に見直した。目的は「異常な肥大化を止める」ことであって特定の数値ではない
- **NFR5 依存境界の検出時点**: 宣言外の層への bare import は (a) `bunx tsc --noEmit` で型エラー、(b) `bun test` の architecture 規則で違反、(c) 実行時に解決失敗、の 3 点すべてで検出される。パッケージ外への相対 import は (b) で検出される
- **NFR6 保守性**: 層パッケージを 1 つ足すとき変更が要るのは `package.json`（新規）・root `workspaces`・`rules.ts` の許可表・（必要なら）entry の依存だけであり、手順を `README` に 1 節で書ける

## 制約

- bun 1.3.13（`mise.toml`・CI の `setup-bun`）、TypeScript 7.0.2、ソルバーは exact pin（`formal-verification-ops.md` §1）。新しい実行時依存を足さない。npm import の許可は `z3-solver` の動的 import のみ（`only-sanctioned-imports`）
- upstream（`aidlc-workflows`）の projection／validate／compose と `.aidlc-plugin/plugin.json` の `contributes.tools` の契約は変えない（`architecture.md` 経路図 2: 拡張子を見る工程は無い）
- 利用先には node_modules が無い（`z3-solver` を除く）。bundle は外部依存を持ち込まない
- コミットは Conventional Commits・英語・叙事スタイル、squash マージ。人が読む文書は日本語（`docs/decisions` は英日両方）
- express の Minimal テスト戦略: 要件ごとに 1 本の検証（FR1.2／FR1.3／FR1.5 は red example、FR3 は drift check、FR4.5 は tombstone 検査、FR5.2 は既存 golden／parity）。既存スイートは緑のまま

## 前提（未検証の仮定）

- **A1** bun 1.3.13 の `bun build` は同一入力から byte 同一の出力を返す（コメントのファイル境界は相対パス、時刻の埋め込みなし）。Code Generation の最初に 2 回ビルドして比較し確認する。破れたら NFR1 の判定方法を見直す（オーナー: 実装担当）
- **A2** isolated linker 下で `bunx tsc --noEmit`（`moduleResolution: bundler`）が `exports` と宣言外依存を尊重する（スパイクで実測済み。tsconfig の `include` が入れ子 `node_modules` を既定で除外するかは要確認）
- **A3** doctor の installed 行のラベル変更は `[desc]` (4) で受け入れ済み
- **A4** `--target=bun` の bundle 先頭 `var __require = import.meta.require;` は node 実行に害がない（スパイク実測: node 24 で `--smt-child` が動作）

## スコープ外

- minify・sourcemap・code splitting（`[Q3]`、`[desc]` (2)）
- 上流 `aidlc-workflows` の `.js` 対応（FR4.1 の裁定で不要になった。別リポジトリの変更はこの intent の範囲外）
- golden の更新、ソルバーの版上げ、findings 文言の変更
- TypeScript project references の導入、パッケージ名の体系変更
- README の `## Future split (NFR4)`（SMT／Quint の 3 プラグイン分割）
- upstream `aidlc-workflows` の変更、運用ステージ（deployment／observability）

## 未解決事項（後段へ）

- `tests/` と `scripts/` が `@deep-spec/*` を解決する方式（root `dependencies` に列挙するか、`src/entries` と同じく workspace メンバーにするか）は Code Generation で実測して決める
- bundle が `import.meta.url` を 2 箇所残す点（スパイク実測）が `data/` 解決以外の用途を持たないことを確認する
- `tests/parity/snapshot.ts` の tool 名 12 箇所は `.js` へ機械置換でよいか（スナップショット自体は entry 名を含まない前提）
