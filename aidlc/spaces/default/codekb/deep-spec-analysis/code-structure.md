# deep-spec-analysis — コード構成

## Focused scan で確認した配布関連の構成

| パス | 現行責務 | intent による変更面 |
|---|---|---|
| `scripts/install.ts` | 346行。引数解釈、source/plugin root、framework toolchain、build、refresh、tombstone、compose、verify、doctor を一体化 | CLI/options、source resolver、destination toolchain、transaction、provenance/update の seam が必要 |
| `scripts/build-tools.ts` | `src/entries/*.ts` を Bun で bundle し、`tools/*.ts` 10本と `tools/data/*.json` 4本を生成 | installer の source 取得後に導入先 builder から間接実行される build 入力。14-file 出荷形は維持対象 |
| `.aidlc-plugin/plugin.json` | plugin `deep-spec-analysis` v0.5.0。stages／overlays／sensors／knowledge／tools を宣言 | tag の版と一致させる対象。provenance JSON は `contributes.tools` に追加しない |
| `src/doctor/{domain,usecase,adapter}` と `src/entries/deep-spec-analysis-doctor.ts` | 5ブロックの check を同期順で合成し `{checks:[...]}` を出力 | install provenance と最新 tag の advisory を追加する候補。公開 JSON shape と既存順序を守る必要がある |
| `tests/intent-e2e.test.ts` | submodule の vanilla dist を使う初回導入、refresh、file/directory tombstone、冪等性 | `--from` と same-version `--update` の Changed 0、取得／offline／失敗境界を追加する回帰網 |
| `.github/workflows/ci.yml` | main push／PR で typecheck、bundle drift、coverage、validate、7 harness build | tag push と manifest/tag 一致検査は未実装 |
| `README.ja.md`、`deep-spec-analysis/README.ja.md`、`tests/README.ja.md` | checkout/submodule 前提の導入・開発・テスト説明 | tag bootstrap、source selector、update、provenance と submodule 不要の利用経路を説明する必要がある |

以下の `tools/` 全域に関する数値と構造は前回 store の記録であり、今回の focused scan では再集計していない。現在の source tree は `src/` と bundle 済み `tools/` の分離を前提にしているため、前回記録の「`tools/` に468 `.ts`」等は歴史的基線として読む。

対象は `deep-spec-analysis/`（ワークスペースルート直下）。数値はすべて developer link の実測（HEAD `94d64a3` 時点）。層別の内訳は `component-inventory.md`、依存は `dependencies.md` を参照。

## tools/ の物理構成

git 管理下の `tools/` は 472 ファイル（`.ts` 468 ＋ `.json` 4）、`.ts` 合計 24,306 行、最大ファイルは `tools/design/adapter/refinement-query-plan.ts` の 395 行（500 行超は無い）。

```
tools/
├── aidlc-sensor-deep-spec-ir-valid.ts            entry（センサー 9 本＋doctor = 10 本、計 787 行。
├── aidlc-sensor-deep-spec-verify-smt.ts            tools/ 直下のフラットファイルはこれだけ）
├── aidlc-sensor-deep-spec-verify-quint.ts
├── aidlc-sensor-deep-spec-refcheck-domain.ts
├── aidlc-sensor-deep-spec-refcheck-contract.ts
├── aidlc-sensor-deep-spec-refcheck-functional.ts
├── aidlc-sensor-deep-spec-design-ir-valid.ts
├── aidlc-sensor-deep-spec-design-verify-smt.ts
├── aidlc-sensor-deep-spec-design-verify-quint.ts
├── deep-spec-analysis-doctor.ts
├── data/                                          契約スキーマ 4 本（entry が import.meta.url 相対で解決）
│   ├── deep-spec-ir-schema.json                   契約 1
│   ├── deep-spec-findings-schema.json             契約 2
│   ├── deep-spec-design-ir-schema.json            契約 3
│   └── deep-spec-refinement-map-schema.json       契約 4
├── kernel/        {infrastructure, domain, usecase, adapter}/   kernel だけが infrastructure を持つ
├── requirements/  {domain, usecase, adapter}/
├── design/        {domain, usecase, adapter}/
├── refinement/    {domain}/                                     domain 層のみ
├── refcheck/      {domain, usecase, adapter}/
└── doctor/        {domain, usecase, adapter}/
```

- 17 層ディレクトリすべてに `index.ts` facade があり、層の公開面はそこからの再輸出だけ（`export *` は禁止）。層間 import は facade 経由が原則で、例外は 23 本（`dependencies.md`）
- `usecase/port/` は kernel・requirements・design・refcheck・doctor の 5 つにあり、Repository と Client の 2 種のポート型を集める。`usecase/read-model/` は doctor だけ
- entry の役割: フラグ解釈（`kernel/adapter/sensor-flags.ts parseFlags`）、`dirname(fileURLToPath(import.meta.url))` による `data/` と兄弟 entry のパス解決、Repository／Client／UseCase の生成、`execute`、verdict 行の出力。`process.*`／`import.meta` を許される唯一の場所（`process-only-in-entries` 規則）。SMT entry は `--smt-child` で子プロセス側にも分岐する
- `tools/` に `Bun.*` API の使用は 0 件、`TODO/FIXME/HACK` も 0 件

## tools/ 以外のディレクトリと設定

| パス | 役割 |
|---|---|
| `tests/` | `bun:test` のスイート 23 本（`*.test.ts`）、`architecture/rules.ts`（18 規則の純粋関数）、`doubles/`（in-memory Repository 2 本）、`fixtures/`（conformance／design／refcheck broken・clean／refinement／intent-e2e／invalid。byte 凍結の golden JSON）、`parity/`（`snapshot.ts` ＋ `parity.test.ts`。entry の spawn 出力を丸ごとスナップショット）、`README.md`／`README.ja.md`。テストが `tools/` に到達する経路は `code-quality-assessment.md` |
| `scripts/` | `install.ts`（projection ビルド → upgrade refresh → tombstone → compose → doctor 実行。`Bun.which` を使う唯一の場所）、`smt-stress.ts`（SMT の負荷試験。entry パスを `.ts` で保持） |
| `sensors/` | センサー manifest 9 本（frontmatter: `id`・`kind: deterministic`・`command: bun {{HARNESS_DIR}}/tools/<entry>.ts`・`default_severity: advisory`・`matches` glob・`timeout_seconds`） |
| `knowledge/` | IR 著述ガイド 3 本: `aidlc-product-agent/deep-spec-ir-authoring.md`（`{{HARNESS_DIR}}/tools/data/deep-spec-ir-schema.json` を参照）、`aidlc-architect-agent/deep-spec-design-ir-authoring.md`、`aidlc-architect-agent/deep-spec-refinement-map-authoring.md` |
| `stages/` | `inception/deep-spec-analysis-verify.md`（2.35、sensors: ir-valid／verify-smt／verify-quint）、`construction/deep-spec-analysis-functional-verify.md`（3.55、sensors: design-ir-valid／design-verify-smt／design-verify-quint。本文 84-86 行に refcheck 3 本の手打ちコマンド例が `.ts` で書かれている） |
| `contributions/` | コアステージへの overlay 3 本: `inception/domain-design.md`（`adds.consumes` に report、`adds.sensors` に refcheck-domain）、`inception/contract-design.md`（refcheck-contract）、`construction/functional-design.md`（refcheck-functional）。`tools/` パスは含まない |
| `docs/` | `decisions.md`／`decisions.ja.md`（約 1,800 行の設計判断記録）、`handoffs/71-tda-program.ja.md`（#71 プログラムの引き継ぎ） |
| `.aidlc-plugin/plugin.json` | プラグイン定義（v0.5.0、`contributes`: stages／overlays／sensors／knowledge／tools） |
| `package.json` | `deep-spec-analysis-plugin-dev`（private、devDependencies 4 本、`workspaces` 無し） |
| `bunfig.toml` | `[test]` のみ（カバレッジ床 0.9、除外パターンは `tools/` 起点）。`[install]` は無い（linker 未指定＝hoisted） |
| `tsconfig.json` | `moduleResolution: bundler`、`allowImportingTsExtensions`、`noEmit`、`strict`、`include: ["scripts/**/*.ts", "tools/**/*.ts", "tests/**/*.ts"]` |
| `dist/`（gitignore） | `dist/<harness>/`。`dist/claude/tools` は 472 ファイルで `tools/` と同数（逐語コピー） |
| `README.md`／`README.ja.md` | 構成表（`tools/aidlc-sensor-*.ts`・`tools/<ctx>/{domain,usecase,adapter}/`・`tools/data/*.json`・doctor）と「5 コンテキスト × 4 層」の説明。`## Future split (NFR4)` は SMT／Quint の 3 プラグイン分割案で本 intent とは別物 |

ワークスペースルート側の関連ファイル（浅読み）: `.github/workflows/ci.yml`（`working-directory: deep-spec-analysis`）、`mise.toml`（bun 1.3.13・node 24）、`renovate.json`、`aidlc-workflows/`（submodule。validate／build ツールチェーン）。

## 命名と配置の規則

`tests/architecture/rules.ts` が機械検査し、`docs/decisions.ja.md` の裁定が根拠になっている規則:

- **層の位置はパスで決まる**: `<ctx>/<layer>/...` の先頭 2 セグメント（`locationOf`）。ctx は `kernel | requirements | design | refinement | refcheck | doctor`、layer は `infrastructure | domain | usecase | adapter`。entry は `ENTRY_FILES` のフラット basename 10 本、`data/` は契約スキーマ。これ以外のフラットファイルは未分類として違反
- **1 公開型 1 ファイル**（`one-public-type-per-file`）、ファイル名は kebab-case（例: `refinement-query-plan.ts`、`z3-solver-client-impl.ts`）。実装クラスは `*Impl`、ユースケースは `*UseCase`、ポートは `usecase/port/` に置く（`ports-live-in-port-dir`）
- **domain 層**: フィールドは `#private`（`domain-fields-are-private`）、コンストラクタは private で門は `of`（検証つき）／`reconstitute`（逐語）（`private-constructor-in-domain`）、get アクセサ・TS enum・非 null アサーション禁止、プロパティを持つ公開 interface／object 型はデータモデルとして禁止（`no-data-models-in-domain`）、プリミティブ型のフィールド禁止（`no-primitive-fields-in-domain`）。免除は `PUBLISHED_LANGUAGE` 表の 11 項目だけ（`published-language-layers` が利用可能層も縛る）
- **I/O と環境**: `node:fs`／`node:child_process` などの I/O は adapter だけ（`no-io-in-pure-layers`）、`process.*`／`import.meta` は entry だけ（`process-only-in-entries`）、npm import は `z3-solver` の動的 import だけ（`ALLOWED_NPM`）
- **import**: `./`・`../` の相対 import と sanctioned な層だけ（`only-sanctioned-imports`）、entry を import しない（`no-entry-imports`）、`export *` 禁止（`no-export-star`）、方向は `layer-direction` と `SANCTIONED_CROSS_CONTEXT` の 4 辺
- **コマンドは返さない**: `store` などのコマンドは `void`（`commands-return-void`、CQS 裁定）
- **テストペイロード禁止**: `tools/` にテスト用の payload を置かない（`no-test-payloads`）
- **コメント**: 日英混在で密度が高い。各 adapter の冒頭に「なぜ entry が注入するか」の説明がある

## 関連成果物

- 各層の責務と数字: `component-inventory.md`
- 依存エッジ: `dependencies.md`
- 規則の完全な一覧と品質指標: `code-quality-assessment.md`
