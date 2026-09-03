# Reverse Engineering — developer code scan（link 1 handoff）

- intent: `260903-src-bundle-split`（Brownfield / express / Depth: Minimal / Test Strategy: Minimal）
- 対象リポジトリ: `deep-spec-analysis`（ワークスペースルートの git リポジトリ）。この intent の対象はルート直下の `deep-spec-analysis/`（AI-DLC プラグイン本体、bun / TypeScript）
- スキャン日: 2026-09-03、HEAD `94d64a3`（コミット数 144、初回コミット 2026-08-28）
- 記法: 本文中の「実測」はファイルを読んだ・コマンドを走らせた結果、「推測」は未検証の見立て。特記のない事実は実測

## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply**（実際に読んで理解した範囲。すべてワークスペースルート相対）:
  - `deep-spec-analysis/tools/`（entry 10 本は全文、層ディレクトリは facade・spawn 系 adapter・doctor manifest を全文、それ以外は import 走査スクリプトで全 468 ファイルの import を機械集計）
  - `deep-spec-analysis/tests/`（`architecture/rules.ts`・`architecture.test.ts`・`intent-e2e.test.ts`・`plugin.test.ts`・`conformance.test.ts` 冒頭・`parity/snapshot.ts` の spawn 部・`README.md`、および全テストの `tools/` 参照を grep）
  - `deep-spec-analysis/scripts/`（`install.ts` 全文、`smt-stress.ts` 冒頭）
  - `deep-spec-analysis/sensors/`（9 本の frontmatter、`aidlc-deep-spec-verify-smt.md` 全文）
  - `deep-spec-analysis/knowledge/`（`tools/` パス参照の grep）
  - `deep-spec-analysis/stages/`・`deep-spec-analysis/contributions/`（frontmatter と `tools/` パス参照）
  - `deep-spec-analysis/docs/`（`decisions.md` の見出しと `tools/`・bundle 関連の grep、`handoffs/71-tda-program.ja.md` の見出し）
  - `deep-spec-analysis/package.json`、`deep-spec-analysis/bunfig.toml`、`deep-spec-analysis/tsconfig.json`、`deep-spec-analysis/README.md`（`.gitignore`・`bun.lock` 冒頭・`.aidlc-plugin/plugin.json` も併読）
- **Skimmed only**:
  - `.github/workflows/ci.yml`、`renovate.json`、`mise.toml`（全文だが短い）
  - `aidlc/spaces/default/knowledge/aidlc-shared/`（4 ファイル。事実確認に使用）
  - `aidlc-workflows/core/tools/aidlc-plugin-build.ts`・`aidlc-plugin-validate.ts`（`tools/` 契約に関わる箇所だけ grep と部分読み。`aidlc-plugin-emit.ts` はコピー方式の grep のみ）
  - ブリーフの集合外だが 1 回だけ覗いた: `deep-spec-analysis/dist/claude/`（出荷物の形の確認。ファイル数と `hooks/compose.ts` の grep のみ。解析対象には含めない）
- **実行したコマンド（実測）**: `bun test --coverage`（26.8 秒）、`bunx tsc --noEmit`（TypeScript 7.0.2、0.14 秒）、scratchpad での 2 本のスパイク（`bun build` による bundle 実射、bun workspaces + isolated linker の挙動）。リポジトリのファイルは変更していない

### Packages Found

- `deep-spec-analysis-plugin-dev` — npm パッケージ（private、devDependencies のみ、`workspaces` なし）— TypeScript — 開発用ハーネス。「Nothing here ships」と自己申告（`package.json:3`）。出荷単位は npm ではなく AI-DLC プラグイン projection
- `deep-spec-analysis`（`.aidlc-plugin/plugin.json`、v0.5.0、depends on `core`）— AI-DLC プラグイン — 貢献先: `stages/`・`contributions/`（overlays）・`sensors/`・`knowledge/`・`tools/`
- **`tools/` の論理パッケージ（6 コンテキスト × 層 = 17 層ディレクトリ、すべて `index.ts` facade あり）**:

| 層ディレクトリ | .ts ファイル数（index 含む） | 行数 | facade の再輸出数 |
|---|---|---|---|
| `tools/kernel/infrastructure` | 4 | 44 | 3 |
| `tools/kernel/domain` | 26 | 1,066 | 24 |
| `tools/kernel/usecase` | 3 | 27 | 2 |
| `tools/kernel/adapter` | 17 | 580 | 16 |
| `tools/requirements/domain` | 65 | 3,477 | 67 |
| `tools/requirements/usecase` | 18 | 492 | 17 |
| `tools/requirements/adapter` | 19 | 1,962 | 18 |
| `tools/design/domain` | 85 | 4,464 | 84 |
| `tools/design/usecase` | 18 | 835 | 17 |
| `tools/design/adapter` | 22 | 1,800 | 19 |
| `tools/refinement/domain` | 37 | 2,114 | 38 |
| `tools/refcheck/domain` | 85 | 4,126 | 81 |
| `tools/refcheck/usecase` | 11 | 228 | 10 |
| `tools/refcheck/adapter` | 7 | 889 | 6 |
| `tools/doctor/domain` | 11 | 355 | 10 |
| `tools/doctor/usecase` | 21 | 492 | 20 |
| `tools/doctor/adapter` | 9 | 568 | 8 |

  - `refinement` は domain 層だけ（usecase / adapter なし）。`kernel` だけが `infrastructure` を持つ。`usecase/port/` は kernel・requirements・design・refcheck・doctor の 5 つ、`usecase/read-model/` は doctor のみ
  - entry（`tools/` 直下のフラットファイル）: センサー 9 本＋doctor = 10 本、計 787 行。`tools/data/`: JSON Schema 4 本（`deep-spec-ir-schema.json`・`deep-spec-findings-schema.json`・`deep-spec-design-ir-schema.json`・`deep-spec-refinement-map-schema.json`）
  - git 管理下の `tools/` は 472 ファイル（.ts 468 ＋ .json 4）、.ts 合計 24,306 行。最大ファイルは `tools/design/adapter/refinement-query-plan.ts` の 395 行（500 行超のファイルなし）
  - `dist/`（gitignore、ローカルにビルド済み）: `dist/claude/tools` は 472 ファイルで `tools/` と同数。projection は `tools/` を逐語コピーする（`aidlc-plugin-build.ts` → `aidlc-plugin-emit.ts` の `cpSync`。フィルタは validate 側の tests/fixtures/`.test.ts` 拒否のみ）

### Build System

- **Type**: bun 1.3.13（`mise.toml`・CI `setup-bun` で固定）。ビルド工程は現状 **無し**——`tools/*.ts` を bun が直接実行し、projection は `.ts` をそのままコピーする。型検査は TypeScript 7.0.2（`bunx tsc --noEmit`、exit 0、実測 0.14 秒）。node 24（`mise.toml`・CI `setup-node`）は SMT センサーの z3 子プロセス専用
- **Config Files**:
  - `package.json`（devDependencies 4 本、すべて exact pin: `@informalsystems/quint 0.32.0`・`@types/bun 1.4.0`・`typescript 7.0.2`・`z3-solver 5.2.0`）、`bun.lock`（lockfileVersion 1、`workspaces: { "": ... }` のみ）
  - `bunfig.toml`: `[test]` のみ。`coverageThreshold = 0.9`、`coverageSkipTestFiles = true`、`coveragePathIgnorePatterns` は `tests/**`・`scripts/**`・`tools/aidlc-sensor-*.ts`・`tools/deep-spec-analysis-doctor.ts`・`tools/deep-spec-lib.ts`・`tools/deep-spec-refinement-lib.ts`（後 2 つは既に存在しない残骸）・`tools/data/**`・各コンテキストの `adapter/**` と `usecase/**`（kernel は adapter のみ除外）。**`[install]` セクションは無い**（linker 未指定＝hoisted）
  - `tsconfig.json`: `moduleResolution: "bundler"`、`allowImportingTsExtensions`、`noEmit`、`strict`、`noUnusedLocals/Parameters`、`types: ["bun"]`、`include: ["scripts/**/*.ts", "tools/**/*.ts", "tests/**/*.ts"]`
  - `.gitignore`（`node_modules/`・`dist/`——先頭スラッシュ無しなので入れ子の `node_modules/` も対象）
  - CI `.github/workflows/ci.yml`（`working-directory: deep-spec-analysis`、submodule 取得 → node 24 → bun 1.3.13 → `bun install --frozen-lockfile` → `bunx tsc --noEmit` → `bun test --coverage` → `aidlc-plugin-validate.ts .` → 7 ハーネス分の `aidlc-plugin-build.ts`）
  - `renovate.json`（solver 2 本は Dependency Dashboard 承認制、bun ランタイムと `@types/bun` を同時更新、GitHub Actions を 1 本に束ねる）
- **Build Dependencies（層間の実 import エッジ。import 走査スクリプトで 468 ファイル・1,747 import を機械集計。すべて facade `index.ts` 経由か、後述の 23 件の直接 import）**:

| 層（将来の package 候補） | 依存先の層 |
|---|---|
| kernel/infrastructure | （なし。node import も無し） |
| kernel/domain | kernel/infrastructure |
| kernel/usecase | （なし） |
| kernel/adapter | kernel/infrastructure、kernel/usecase（**kernel/domain を import しない**） |
| requirements/domain | kernel/domain、kernel/infrastructure |
| requirements/usecase | requirements/domain、kernel/domain、kernel/infrastructure、kernel/usecase |
| requirements/adapter | requirements/domain、requirements/usecase、kernel/adapter、kernel/domain、kernel/infrastructure、kernel/usecase、npm `z3-solver`（動的 import） |
| design/domain | kernel/domain、kernel/infrastructure |
| design/usecase | design/domain、refinement/domain、kernel/domain、kernel/infrastructure、kernel/usecase |
| design/adapter | design/domain、design/usecase、refinement/domain、kernel/adapter、kernel/domain、kernel/infrastructure、kernel/usecase |
| refinement/domain | requirements/domain、design/domain、kernel/domain、kernel/infrastructure |
| refcheck/domain | kernel/domain、kernel/infrastructure |
| refcheck/usecase | refcheck/domain、kernel/domain、kernel/infrastructure、kernel/usecase |
| refcheck/adapter | refcheck/domain、refcheck/usecase、kernel/adapter、kernel/domain、kernel/infrastructure、kernel/usecase |
| doctor/domain | kernel/domain |
| doctor/usecase | doctor/domain |
| doctor/adapter | doctor/domain、doctor/usecase、kernel/domain |
| entry（10 本） | 自コンテキストの domain/usecase/adapter ＋ kernel/adapter ＋ kernel/domain（design entry は加えて refinement 語彙を adapter 経由で使用。doctor entry は doctor 3 層のみ） |

  - コンテキスト横断エッジは `tests/architecture/rules.ts` の `SANCTIONED_CROSS_CONTEXT` 4 本（`refinement/domain→requirements/domain`、`refinement/domain→design/domain`、`design/usecase→refinement/domain`、`design/adapter→refinement/domain`）に一致し、それ以外は kernel 向きのみ。パッケージ依存としては非循環（`design/domain ← refinement/domain ← design/usecase`）
  - node 組み込みの使用層: entry `node:path`・`node:url`、kernel/domain `node:crypto` のみ、kernel/adapter `node:fs`・`node:path`、requirements/adapter・design/adapter・doctor/adapter `node:child_process`・`node:fs`・`node:os`・`node:path`、refcheck/adapter `node:fs`・`node:path`。`Bun.*` API の使用は `tools/` 内に **0 件**（`scripts/install.ts:254` の `Bun.which` のみ）

### APIs Discovered

- **CLI（センサー entry 9 本）** — `tools/aidlc-sensor-deep-spec-*.ts` — 共通契約: `--stage <slug> --output-path <path>`（refcheck 3 本は `--report-only` も）を `kernel/adapter/sensor-flags.ts parseFlags` で解釈、stdout に JSON verdict 1 行（`pass`・`findings_count`・`skipped_count`・`method`・`note`）、exit 0（判定）/ 1（引数不備・書込失敗）/ 127（ソルバ不在）。対象外の basename は `note: "not-applicable"` で素通し。9 本とも `join(dirname(fileURLToPath(import.meta.url)), "data", "<schema>.json")` で **自分の隣の `data/`** からスキーマパスを解決して usecase に注入する
- **CLI（doctor）** — `tools/deep-spec-analysis-doctor.ts` — 引数なし。env `AIDLC_PROJECT_DIR`（既定 `process.cwd()`）・`AIDLC_HARNESS_DIR`（既定 `.claude`）から harness ルートを決め、stdout に `{"checks":[{pass,label,fix?,severity?}]}` を 1 行。checks の順序（manifest → solvers → 要件カバレッジ → 構造負債 → 設計カバレッジ）は凍結
- **子プロセス協定（`--smt-child`）** — `tools/aidlc-sensor-deep-spec-verify-smt.ts:98-101` — 同じ entry が `process.argv.includes("--smt-child")` で分岐し、stdin の `{queries:[{id,script,assumptions,model:[{name,sort}]}],timeoutMs,budgetMs}` を `requirements/adapter/z3-engine-child.ts solveSmtChild` で解いて stdout に `{results:[...]}` または `{unavailable}` を 1 行返す（プロトコル凍結）。親側は `requirements/adapter/z3-solver-client-impl.ts:56`（`selfPath` を entry が注入）と `design/adapter/refinement-solver-client-impl.ts:64`（`childHostPath` を design-verify-smt entry が `join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts")` で注入）が `spawnSync(runtime, [path, "--smt-child"])` を node 優先・bun フォールバックで実行
- **兄弟 entry の spawn** — `tools/design/adapter/sibling-backend-client-impl.ts:50` が `join(this.#config.toolsDirectory, \`aidlc-sensor-deep-spec-verify-${backend}.ts\`)` を `bun` で spawn（`toolsDirectory` は design entry が `dirname(fileURLToPath(import.meta.url))` で注入）。doctor は `tools/doctor/adapter/refcheck-backend-client-impl.ts:105` で `join(root, "tools", tool)` を spawn し、`tool` 名は `tools/doctor/adapter/doctor-workspace-client-impl.ts:138,140,158` の文字列 `aidlc-sensor-deep-spec-refcheck-{domain,contract,functional}.ts`
- **外部 CLI** — `quint`（`AIDLC_DEEP_SPEC_QUINT_BIN` 既定 `"quint"`、`spawnSync` で `--version` probe / `run` / `verify`、`killSignal: "SIGINT"`）、`java -version`（Apalache 検出）、doctor の Apalache 陳腐化 probe は `process.execPath -e <node:net connect 8822>`
- **環境変数** — `AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS`・`AIDLC_DEEP_SPEC_SMT_RUNTIME`・`AIDLC_DEEP_SPEC_QUINT_BIN`・`AIDLC_DEEP_SPEC_QUINT_METHOD`・`AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP`・`APALACHE_DIST`・`HOME`・`AIDLC_PROJECT_DIR`・`AIDLC_HARNESS_DIR`。すべて entry だけが読む（`process-only-in-entries` 規則で機械検査）
- **データ契約（JSON Schema 4 本、`tools/data/`）** — 契約 1 IR、契約 2 findings（`deep-spec-verify/<backend>.json`・`deep-spec-refcheck/*.json`・`deep-spec-design-verify/*.json`、`cross-check.json`）、契約 3 設計 IR、契約 4 refinement map。レポートは書き出し前にこのスキーマで自己検証する（`*-serializer.ts` の `self-validation against deep-spec-findings-schema.json failed`）
- **センサー manifest（`sensors/*.md`、9 本）** — frontmatter `command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-<id>.ts`（全 9 本が `.ts` 固定）、`kind: deterministic`、`default_severity: advisory`、`matches` glob、`timeout_seconds`（ir-valid 15 / refcheck 10 / smt 75 / quint 75 / design-smt 75 / design-quint 85）
- **ステージ／貢献** — `stages/inception/deep-spec-analysis-verify.md`（sensors: ir-valid, verify-smt, verify-quint）、`stages/construction/deep-spec-analysis-functional-verify.md`（sensors: design-ir-valid, design-verify-smt, design-verify-quint。本文 84-86 行に refcheck 3 本の **手打ちコマンド例 `bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-*.ts`**）、`contributions/{inception/domain-design, inception/contract-design, construction/functional-design}.md`（`adds.sensors` で refcheck を注入。`tools/` パスは含まない）
- **インストーラ** — `scripts/install.ts`: `aidlc-plugin-build.ts` → upgrade refresh（dist と同名の既存ファイルを削除）→ tombstone（`REMOVED_PAYLOADS` の 4 件、ファイル単位 `rmSync`）→ store ハーネスはコピー無しで compose → 検証は `sensors/aidlc-deep-spec-ir-valid.md` の存在 → **`tools/deep-spec-analysis-doctor.ts` を spawn**（`install.ts:290`）してカバレッジ負債を表示

### Frameworks & Libraries

- bun — 1.3.13 — ランタイム・テストランナー（`bun:test`）・（将来）バンドラ。`bun build --help` で `--target bun|node|browser`・`--external`・`--splitting`・`--minify` を確認、`bun install --help` で `--linker=isolated|hoisted` を確認（実測）
- TypeScript — 7.0.2 — 型検査のみ（`noEmit`）。`bunx tsc --noEmit` 0.14 秒
- z3-solver — 5.2.0（exact）— SMT バックエンド。`tools/requirements/adapter/z3-engine-child.ts:29` の `await import("z3-solver")` だけが npm import（`tests/architecture/rules.ts:187 ALLOWED_NPM`）。利用先プロジェクトの `node_modules/z3-solver` から解決する前提（doctor も `<projectDir>/node_modules/z3-solver/package.json` の存在を見る）
- @informalsystems/quint — 0.32.0（exact）— Quint CLI（テストは `node_modules/.bin/quint` を `AIDLC_DEEP_SPEC_QUINT_BIN` で注入）。Apalache（JDK）は任意
- @types/bun — 1.4.0 — 型
- 実行時の外部依存は node 組み込みと上記だけ（フレームワーク無し）。lint ツール（ESLint/Biome/Prettier）の設定ファイルはリポジトリ・ワークスペースルートともに **無し**

### Test Coverage

- **Test Directories**: `tests/`（`.test.ts` 23 本、`architecture/rules.ts`、`doubles/`（in-memory repository 2 本）、`fixtures/`（conformance／design／refcheck broken・clean／refinement／intent-e2e／invalid、byte-frozen golden JSON）、`parity/`（`snapshot.ts` ＋ `parity.test.ts`）、`README.md`／`README.ja.md`）
- **Test Frameworks**: `bun:test`。実測 `bun test --coverage`: **480 テスト（479 pass / 1 skip / 0 fail）、3,149 expect、26.8 秒、exit 0**。カバレッジ All files 99.84%（行）/ 99.96%（関数）、床 0.9 は非除外パス（各 domain 層と kernel の infrastructure/domain/usecase）に対して per-file で効く
- **Coverage Config**: `bunfig.toml`（上記）。CI は `bun test --coverage` で床割れを失敗にする
- **テストが `tools/` に到達する経路（src/ 移動で変わる箇所）**:
  1. **in-process import**: 17 テストファイル＋`tests/doubles/` 2 本が `../tools/<ctx>/<layer>/index.ts`（doubles は `../../tools/...`）を import。**facade 以外への直接 import は 0 件**（grep 実測）。`tests/architecture.test.ts` は `../tools` を `toolsDir` として歩き（`walkToolsFiles`、**symlink を見つけたら fail**）、`tests/architecture/rules.ts` の 18 規則を全ファイルに適用
  2. **entry の spawn（パス文字列）**: `conformance.test.ts:42`、`design-verify.test.ts:49`、`refcheck.test.ts:41`、`refinement.test.ts:38`、`ir-validation.test.ts:83`、`parity/snapshot.ts:232`（tool 名 12 箇所は `.ts`）、`verify-smt-pipeline.test.ts:84`（`sensorPath`）、`design-pipeline.test.ts:122`（`toolsDirectory`）、`refinement-pipeline.test.ts:117,123`（`toolsDirectory`・`childHostPath` に `.ts`）——いずれも `join(pluginRoot, "tools", ...)`
  3. **`tools/data/*.json` の読取**: `design-verify.test.ts:170-171`、`design-pipeline.test.ts:99`、`ir-validation.test.ts:58-59`、`refcheck-pipeline.test.ts:73`、`refcheck-report.test.ts:45`、`refcheck.test.ts:206`、`refinement-pipeline.test.ts:103-104`、`verify-quint-pipeline.test.ts:54`、`verify-smt-pipeline.test.ts:82`
  4. **`intent-e2e.test.ts`**: `aidlc-workflows/dist/claude` を一時 sandbox にコピー → `node_modules` を symlink → `scripts/install.ts --project <sandbox>` でビルド＋compose → **compose 後の `.claude/tools/*.ts` を実射**（`aidlc-sensor-deep-spec-verify-smt.ts`・`-ir-valid.ts`・`-refcheck-domain.ts`・doctor、および実ディスパッチャ `aidlc-sensor.ts fire`）。compose 検査リスト（原本 478-503 行）は entry 3 本＋**17 個の `index.ts` canary**（`refcheck/domain/index.ts` … `doctor/adapter/index.ts`）の存在を assert。tombstone 検査（原本 687-700 行）は `.claude/tools/deep-spec-lib.ts` を植えて `--skip-build` 再導入で消えることを assert
  5. **`tests/doctor-domain.test.ts:24-27`**: `InstallationManifest.standard()` に `tools/deep-spec-analysis-doctor.ts`・`tools/doctor/{domain,usecase,adapter}/index.ts` が含まれることを assert
  6. **`tests/plugin.test.ts`**: `aidlc-workflows/core/tools/aidlc-plugin-validate.ts` を実行し `Plugin validation: VALID` を assert
  7. `tests/architecture.test.ts` 305-345 行: entry 集合が 10 でフラットファイルはそれだけ、published-language 表 11 項目の実在、domain の公開 interface が `kernel/domain/expression.ts:Expression` だけであることを assert

### Code Quality Indicators

- **Linting**: 専用 linter なし。代わりに (a) `tsc --strict` ＋ `noUnusedLocals/Parameters`、(b) `tests/architecture/rules.ts` の 18 規則（`no-test-payloads`・`only-sanctioned-imports`・`no-entry-imports`・`no-io-in-pure-layers`・`process-only-in-entries`・`no-export-star`・`layer-direction`・`private-constructor-in-domain`・`no-get-accessors`・`no-enums`・`no-non-null-assertions`・`one-public-type-per-file`・`ports-live-in-port-dir`・`commands-return-void`・`no-data-models-in-domain`・`no-primitive-fields-in-domain`・`domain-fields-are-private`・`published-language-layers`）を red/green example つきで全ファイルに適用。`tools/` 内の `TODO/FIXME/HACK` は 0 件、抑止コメントは `z3-engine-child.ts:301` の `biome-ignore` 1 件（linter 不在なので効力なし）
- **CI/CD**: `.github/workflows/ci.yml` 1 本（上記）。配布＝projection ビルド＋PR マージ（運用ステージ対象外、intent 記述どおり）
- **Documentation**: `README.md`／`README.ja.md`（構成表に `tools/aidlc-sensor-*.ts`・`tools/<ctx>/{domain,usecase,adapter}/`・`tools/data/*.json`・`tools/deep-spec-analysis-doctor.ts` を明記。91 行目に「`tools/` は 5 コンテキスト × 4 層…唯一のフラットファイルは entry」の説明、93 行目 `## Future split (NFR4)` は SMT/Quint の 3 プラグイン分割案で、本 intent の src/ 分離とは別物）、`tests/README.md`、`docs/decisions.md`／`.ja.md`（約 1,800 行の設計判断記録、`tools/` 言及 12 箇所——歴史記述なので更新不要と判断）、`docs/handoffs/71-tda-program.ja.md`、`knowledge/` 3 本（`aidlc-product-agent/deep-spec-ir-authoring.md:26` が `{{HARNESS_DIR}}/tools/data/deep-spec-ir-schema.json` を参照——`data/` は残るので不変）。コードのコメントは日英混在で密度が高く、各 adapter の冒頭に「なぜ entry が注入するか」の説明がある

### Technical Debt Signals

intent（src/ 分離＋bundle 化）に効くものを優先して列挙する。

1. **`.ts` 固定のパス文字列が出荷経路の 5 箇所に散在**（すべて実測）: (a) `sensors/*.md` の `command:` 9 本、(b) `tools/design/adapter/sibling-backend-client-impl.ts:50` のテンプレート `aidlc-sensor-deep-spec-verify-${backend}.ts`、(c) `tools/aidlc-sensor-deep-spec-design-verify-smt.ts:52` の `childHostPath: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts")`、(d) `tools/doctor/adapter/doctor-workspace-client-impl.ts:138,140,158` の refcheck tool 名、(e) `tools/doctor/domain/installation-manifest.ts` の 44 行の台帳（entry `.ts` 10 本＋`index.ts` canary 17 本＋sensors/knowledge/data）。加えて `stages/construction/deep-spec-analysis-functional-verify.md:84-86` の手打ちコマンド例、`scripts/install.ts:290`、`scripts/smt-stress.ts:348`、README 2 本の表、テスト側（Test Coverage 2・4・5 項）
2. **`import.meta.url` 相対の `data/` 探索が entry 9 本に埋め込み**（`dirname(fileURLToPath(import.meta.url))` → `data/<schema>.json`）。bundle 化しても bundle が `tools/` 直下に置かれ `data/` が隣に残る限り成立する——**スパイクで実測**: `bun build --target=bun --external z3-solver` した `aidlc-sensor-deep-spec-verify-smt.js` を `data/` の隣に置き conformance fixture に実射したところ verdict `{"pass":false,"findings_count":4,"skipped_count":2,"method":"exhaustive"}`、生成された `smt.json` は `tests/fixtures/conformance/expected/smt.json` と **byte 同一**（`cmp` 一致）。`aidlc-sensor-deep-spec-ir-valid.js` も `{"pass":true,"findings_count":0,"errors":[]}`、doctor bundle も JSON を返した
3. **bundle 化の実測プロファイル**（同スパイク、bun 1.3.13、`--target=bun`、splitting 無し、minify 無し）: 158 モジュールを 6 ms で bundle、`aidlc-sensor-deep-spec-verify-smt.js` 158.5 KB / 4,957 行、`-ir-valid.js` 156.8 KB / 4,919 行、doctor 49.6 KB / 1,702 行。先頭 2 行は `// @bun` と `var __require = import.meta.require;`（以降 `__require(` の使用は 0 件）、`node:path` などの specifier は bare（`"path"`）に書き換わる、`import.meta.url` は 2 箇所そのまま残る、`await import("z3-solver")` は external として残る、SMT entry 末尾の top-level `await solveSmtChild()` も残る。**node 24.19.0 が同 bundle の `--smt-child` 分岐を直接実行できることを実測**（stdin に 2 クエリ → `{"results":[{"id":"q1","status":"sat","model":{"x":"4"}},{"id":"q2","status":"unsat","core":[]}]}`、exit 0）。参考: 同じ分岐を bun in-process で空クエリ実行しても `{"results":[]}` で落ちなかったが、z3 の pthread abort は実クエリ時に起きるという既存知見（`formal-verification-ops.md` §2）を覆す根拠にはならない（推測。node 優先の現行方針は維持）
4. **facade を経由しない層またぎ import が 23 件**（import 走査で実測。`exports` を `index.ts` に絞ると tsc / bun の両方で解決不能になる）: `tools/refcheck/adapter/{component-catalog-parser, contract-summary-parser, functional-design-parser, reference-check-report-repository-impl, reference-check-report-serializer}.ts` → `kernel/adapter/{fence, json, yaml, md-table, contract-schema, canonical-json, schema, schema-unreadable}.ts`（16 件）、`tools/requirements/domain/{attribute-declaration（`export {AttributeBound} from` の再輸出を含む）, background-assumption, obligation, quint-machine-component, scenario}.ts` → `kernel/domain/{attribute-bound, expression}.ts`（6 件）、`tools/refinement/domain/refinement-map-acquisition.ts` → `design/domain/design-input-anchor.ts`（1 件）。**引かれている名前はすべて対応する facade が既に再輸出している**（各 `index.ts` を grep で確認）ので、facade／パッケージ名への付け替えは機械的
5. **パッケージ境界は bare specifier しか縛らない**（scratchpad スパイクで実測、bun 1.3.13 `[install] linker = "isolated"`、`workspaces` ＋ `exports: {".": "./index.ts"}` ＋ `dependencies: {"@spike/x": "workspace:*"}`）: (a) 宣言外パッケージの import は `error: Cannot find module '@spike/kd' from …` で失敗、(b) `exports` を迂回する深い import `@spike/kd/inner.ts` も同様に失敗、(c) tsc 7.0.2（`moduleResolution: bundler`）は (a)(b) を `TS2307` で検出、(d) **しかし相対パスで隣のパッケージディレクトリへ逃げる `import … from "../kd/inner.ts"` は実行時に通る**。現行 `only-sanctioned-imports` は `./`・`../` を無条件に許し、`layer-direction` が相対 import の宛先を層に分類して裁いている（`rules.ts:189-207, 701-730`）。src/ 化後も「パッケージディレクトリを出る相対 import」を規則で禁じない限り、依存方向の強制は完成しない
6. **isolated linker では entry と tests が「どこかのパッケージの中」に無いと `@deep-spec/*` を解決できない**（同スパイク実測）: ルート `package.json` に依存を書かず `entries/main.ts` から `@spike/ka` を import すると `Cannot find module` で失敗し、`bun build` も `Could not resolve: "@spike/ka"` で止まる。`entries/` を `workspaces` に加えて `dependencies` を宣言すると実行も bundle も通り、bundle には bare の `@spike/*` specifier が **0 件**（workspace パッケージはインライン化される）。`tests/` は現状 `../tools/...` の相対 import なので、src/ 化後は「ルートに `@deep-spec/*` の依存を宣言する」か「相対 import のまま（＝境界検査の外）」かの選択になる
7. **isolated linker は各 workspace パッケージ直下に `node_modules/@deep-spec/<dep>` の symlink を作る**（同スパイク実測: `pkgs/ku/node_modules/@spike/kd -> ../../../kd`、ルート `node_modules` には `.bun/` のみ）。`tests/architecture.test.ts` の `walkToolsFiles` は再帰中に **symlink を見つけると `expect(...).toBe(false)` で fail** し、`node_modules` を除外していない。`deep-spec-analysis/.gitignore` の `node_modules/` は入れ子も無視する。tsconfig の `include` glob が入れ子 `node_modules` を既定除外するかは推測（TypeScript の既定 exclude 挙動）
8. **`bunfig.toml` と `tsconfig.json` は `tools/` 起点**: カバレッジ除外パターンが `tools/<ctx>/adapter/**` などで書かれているため、src/ に移すと adapter／usecase が計測対象に入り 0.9 の床を割る（実測ではなく推測だが、除外理由の注記どおり adapter は spawn 系スイートで検証されており in-process 計測に乗らない）。`tsconfig.include` に `src/**/*.ts` を足さないと型検査対象から外れる
9. **アップグレード経路が `.ts` 468 本の孤児を残す**: `scripts/install.ts` の upgrade refresh は「現 dist に同名で存在するファイル」しか消さず（`refreshPluginPayloads`）、tombstone は `REMOVED_PAYLOADS` にファイル単位で列挙したものを `rmSync(dst, { force: true })`（`recursive` 無し）で消す。bundle 化後の dist には `.js` 10 本＋`data/` しか無いので、既存インストール先の `.claude/tools/aidlc-sensor-*.ts` と `tools/<ctx>/**`（468 本）は消えない。intent-e2e の tombstone 検査（`deep-spec-lib.ts`）はこの機構の回帰網
10. **アーキテクチャ規則の位置分類はパス構造に依存**: `locationOf` は `<ctx>/<layer>/...` の先頭 2 セグメントで層を決め（`rules.ts:49-57`）、entry は `ENTRY_FILES` のフラット basename（`rules.ts:23-34`、テストは `ENTRY_FILES.size === 10` と「フラットファイルは entry だけ」を assert）、`PUBLISHED_LANGUAGE` の鍵は `kernel/domain/expression.ts` 形式の相対パス。走査ルートを `src/` に変えれば層分類と published-language 表はそのまま効くが、`src/entries/<name>.ts` は再分類が要る
11. **upstream 側の `tools/` 契約は拡張子を見ない**（shallow 読み）: `aidlc-plugin-validate.ts validateTools`（938-956 行）は `tests`／`fixtures` ディレクトリと `.test.ts` だけを拒否し、`PLUGIN_SYMLINK_SCAN_DIRS` に `tools` が入る（symlink 禁止）。`aidlc-plugin-build.ts` は `tools/` を丸ごと `cpSync`。compose（`dist/claude/hooks/compose.ts`、shallow）は `{{HARNESS_DIR}}` 置換つき no-clobber コピー——`tools/*.ts` にこのトークンは **0 件**なので bundle には影響しない。つまり `.js` 化・`data/` 同居は projection／validate／compose を変えずに通る（intent 前提「projection ビルド・installer・upstream validate は無変更」と整合）
12. **既存の残骸**: `bunfig.toml` の除外に `tools/deep-spec-lib.ts`・`tools/deep-spec-refinement-lib.ts`（もう存在しない）が残る。`tests/architecture/rules.ts:8-9` の冒頭コメント「フラット 13 ファイルは LEGACY」は PR10 で空化済みの古い記述
13. **決定論の凍結面**: 4 種の findings ゴールデンは byte 凍結、`tests/parity/` は entry の spawn 出力を丸ごと snapshot。bundle 化しても verdict 行・findings JSON の文言と発生順を変えない限り緑（上記 2 の実測が根拠）
14. 大規模／God ファイルなし（最大 395 行）、`process.*`／`import.meta` は entry 10 本に閉じている（`process-only-in-entries` で機械検査、grep でも層ファイルの該当はコメントのみ）——bundle の入口を entry に限定する設計前提は現状のコードで既に満たされている

## Handoff Summary

- **Intent-relevant finding**: `tools/` は「entry 10 本（787 行、`process.*`／`import.meta`／`data/` 探索／兄弟 entry の spawn パスをすべて保持）＋ 17 層ディレクトリ（facade `index.ts` 完備、層間 import は 23 件を除きすべて facade 経由、依存グラフは非循環で `rules.ts` の `SANCTIONED_CROSS_CONTEXT` に一致）＋ `data/` 4 本」で、bundle 化の前提はコード上ほぼ整っている。スパイク実測で (a) `bun build --target=bun --external z3-solver` の bundle が `data/` を隣に置けば golden と byte 同一の `smt.json` を出し、node がその `--smt-child` 分岐を直接実行できること、(b) bun workspaces ＋ isolated linker ＋ `exports` が bare specifier の層違反を実行時と tsc の両方で止めることを確認した。一方、`.ts` 固定のパス文字列は `sensors/*.md`（9）・`sibling-backend-client-impl.ts:50`・design-verify-smt entry:52・`doctor-workspace-client-impl.ts:138,140,158`・`installation-manifest.ts`（entry 10＋`index.ts` canary 17）・stage 本文・install.ts:290・smt-stress.ts:348・README・テスト（spawn 9 箇所、intent-e2e の canary 20 件、doctor-domain.test 4 件）に散在し、これが変更面の大半を占める
- **Risks / follow-up**:
  1. 相対 import はパッケージ境界を素通りする（実測）——`only-sanctioned-imports`／`layer-direction` に「パッケージディレクトリを出る `../` 禁止」を足さない限り、intent の「宣言外の層を解決不能にする」は bare specifier にしか効かない
  2. isolated linker 下では `src/entries/` と `tests/` を workspace メンバー（または root の `dependencies`）にしないと `@deep-spec/*` が解決できず `bun build` も失敗する（実測）
  3. 各層ディレクトリ直下に `node_modules` symlink が生える（実測）——`tests/architecture.test.ts walkToolsFiles` の symlink 拒否と再帰を `node_modules` 除外にしないと architecture テストが落ちる
  4. `installation-manifest.ts` の `index.ts` canary 17 本と intent-e2e の compose 検査リスト、`doctor-domain.test.ts:24-27` は bundle 化で全部書き換えになる（doctor 出力の label 文言＝外部仕様の変更を伴う点は要注意）
  5. `scripts/install.ts` の refresh／tombstone はファイル単位・非再帰なので、既存インストール先の `.ts` 468 本が孤児化する——ディレクトリ単位の tombstone（`rmSync(..., { recursive: true })`）か全 `.ts` 列挙が要る
  6. `bunfig.toml coveragePathIgnorePatterns` と `tsconfig.include` の `tools/` 起点パターンを `src/` に合わせないと、カバレッジ床（0.9）と型検査の対象がずれる（推測、ただし機構上ほぼ確実）
  7. bundle の先頭に bun 固有の `var __require = import.meta.require;` が入る（未使用）。node 実行で害は出なかった（実測）が、`--target=node` との比較は未実施
  8. `bun build` は `node:` 接頭辞を剥がして bare にする（実測）——`no-io-in-pure-layers` の bare 正規化は src 側の規則なので bundle には無関係だが、bundle を規則の走査対象に入れてはいけない
  9. 既存の byte-frozen golden／parity は entry の spawn 出力に依存するので、テストの spawn 先を `.js` に切り替えた後も同じ fixture で緑であることが drift guard と並ぶ受け入れ条件になる
