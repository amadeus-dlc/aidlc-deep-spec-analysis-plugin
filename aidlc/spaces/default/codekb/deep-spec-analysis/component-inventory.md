# deep-spec-analysis — コンポーネント一覧

今回の `analyzed.components` は、次の見出し8件と逐語一致する。以降に残す前回 store の全体 inventory は `UNVERIFIED` な履歴知識であり、今回の verified component list には含めない。

## 今回検証したコンポーネント

### Installer CLI / Transaction

- **実体**: `deep-spec-analysis/scripts/install.ts`
- **責務**: 現行 CLI、projection build、plugin-owned payload refresh、file/directory tombstone、no-clobber compose、verify、doctor 呼び出し。
- **依存**: source checkout、sibling `aidlc-workflows/core/tools`、導入先 filesystem。
- **評価**: at-risk。取得元と処理本体が `import.meta.dir` で密結合し、346行に責務が集中する。build 完了前は target を変更しない境界は保持すべき。

### Tool Bundle Builder

- **実体**: `deep-spec-analysis/scripts/build-tools.ts`
- **責務**: `src/entries` から bundle 10本を生成し、契約 schema 4本と合わせた14-file `tools/` を作る。
- **依存**: Bun bundler、workspace packages、`z3-solver` external contract。
- **評価**: healthy。決定的な build 入力だが、新 installer からは導入先 harness の plugin builder を通じて利用する。

### Plugin Manifest / Version

- **実体**: `deep-spec-analysis/.aidlc-plugin/plugin.json`
- **責務**: plugin 名・version と contributions を宣言する配布識別子。
- **依存**: CI validator、将来の release/tag consistency check。
- **評価**: at-risk。version は0.5.0だが tag はまだ無く、一致を保証する gate もない。

### Doctor Installation Status

- **実体**: `deep-spec-analysis/src/doctor/{domain,usecase,adapter}`、`src/entries/deep-spec-analysis-doctor.ts`
- **責務**: installation manifest を検査して既存 doctor JSON へ描画する。将来は provenance と latest tag の advisory を担う候補。
- **依存**: harness filesystem port、entry の composition、ネットワーク用の新 port（未実装）。
- **評価**: at-risk。現行 `Check` に skip status がなく、既存5ブロックの順序と JSON shape が外部契約。

### Installer / Doctor Test Suites

- **実体**: `deep-spec-analysis/tests/intent-e2e.test.ts`、`plugin.test.ts`、`doctor-domain.test.ts`
- **責務**: 導入・upgrade・tombstone・冪等性、plugin CLEAN、doctor domain／presenter の回帰検証。
- **依存**: Bun Test、一時 sandbox、現在は一部で `aidlc-workflows` submodule。
- **評価**: healthy but incomplete。source selector、provenance、same-version update、network failure、tag consistency の検査は未実装。

### CI / Release Gate

- **実体**: `.github/workflows/ci.yml`
- **責務**: typecheck、generated bundle drift、coverage、plugin validate、7 harness build。
- **依存**: Bun 1.3.13、Node 24、submodule checkout。
- **評価**: healthy for development、at-risk for release。tag trigger と manifest/tag equality は未実装。

### Runtime / Workspace Configuration

- **実体**: `deep-spec-analysis/package.json`、`bun.lock`、`bunfig.toml`、`tsconfig.json`、各 `src/*/*/package.json`、`mise.toml`、`renovate.json`。
- **責務**: exact dependency、workspace package boundary、strict typecheck、domain coverage floor、runtime pin、dependency update policy。
- **評価**: healthy。installer bootstrap の利用先へこれらの devDependencies をそのまま導入する構成ではない。

### Installation Documentation

- **実体**: `README.ja.md`、`deep-spec-analysis/README.ja.md`、`deep-spec-analysis/tests/README.ja.md`
- **責務**: 利用者の導入、開発、テストの入口。
- **評価**: degraded for target UX。現行は clone `--recurse-submodules` と checkout 前提で、tag bootstrap／`--update`／provenance を説明しない。

## 前回 store の全体 inventory（今回未再検証）

コンポーネント名は `reverse-engineering-timestamp.md` の `analyzed.components` と逐語一致させている（見出しがそのまま名前）。数値は developer link の実測（HEAD `94d64a3`、`.ts` 468 本の import を機械集計）。依存エッジの全表は `dependencies.md`、責務の背景は `architecture.md`。

### コンポーネント一覧（リポジトリ直下）

### deep-spec-analysis/tools

プラグインの実行物。entry 10 本、契約スキーマ 4 本、17 層ディレクトリ。projection はこのディレクトリを逐語コピーして利用先の `.claude/tools/` に置く。内部コンポーネント（19 個）を次の表に示す。「依存先」は実 import から起こした層の集合（kernel の各層は `kernel/*` にまとめる。詳細は `dependencies.md`）。

| コンポーネント | `.ts` 数（index 含む） | 行数 | facade 再輸出数 | 責務 | 依存先 |
|---|---|---|---|---|---|
| `entry`（`tools/` 直下 10 本） | 10 | 787 | — | composition root。フラグ解釈、`data/`・兄弟 entry のパス解決、Repository／Client／UseCase の生成、verdict 行の出力。`process.*`／`import.meta` を持つ唯一の場所 | 自コンテキストの domain／usecase／adapter、`kernel/adapter`、`kernel/domain`（design entry は refinement 語彙を adapter 経由で使用。doctor entry は doctor 3 層のみ） |
| `data`（`tools/data/`） | 0（`.json` 4） | — | — | 契約 1〜4 の JSON Schema。entry が `import.meta.url` 相対で読む | なし |
| `kernel/infrastructure` | 4 | 44 | 3 | `Result`／`ok`／`err`／`unreachable`。言語を拡張する純基盤 | なし（node import も無し） |
| `kernel/domain` | 26 | 1,066 | 24 | published language（`Expression`・`KeyedIndex`・`KeySet`・`ErrorMessages`）、ドメインプリミティブ、閉集合語彙（`FindingKind`・`VerificationMethod`・`AttributeKind`） | `kernel/infrastructure`（`node:crypto` を使う唯一の domain） |
| `kernel/usecase` | 3 | 27 | 2 | ポート `RepositoryError`、`Clock` | なし |
| `kernel/adapter` | 17 | 580 | 16 | CLI フラグ、verdict 描画、record ルート探索、JSON Schema 検証、正準 JSON、YAML サブセット／フェンス／Markdown 表のパーサ、`SystemClock`、原子的書込、SMT-LIB 補助 | `kernel/infrastructure`、`kernel/usecase`（**`kernel/domain` を import しない**）、`node:fs`・`node:path` |
| `requirements/domain` | 65 | 3,477 | 67 | 契約 1 の集約 `RequirementsModel`、`VerificationReport`、SMT／Quint の検証計画と判定、IR 宣言 | `kernel/domain`、`kernel/infrastructure` |
| `requirements/usecase` | 18 | 492 | 17 | `VerifyRequirementsSmtUseCase`・`VerifyRequirementsQuintUseCase`・`ValidateIrUseCase` と 6 つのポート | `requirements/domain`、`kernel/*` |
| `requirements/adapter` | 19 | 1,962 | 18 | IR パーサ、Repository 実装、z3 子プロセスクライアントと子側エンジン（`z3-engine-child.ts`、npm `z3-solver` の動的 import）、Quint コンパイラとクライアント、ITF デコード | `requirements/domain`、`requirements/usecase`、`kernel/*`、`z3-solver`、`node:child_process`・`node:fs`・`node:os`・`node:path` |
| `design/domain` | 85 | 4,464 | 84 | 契約 3 の集約 `DesignModel`、lowering、兄弟 verdict、`DesignReport`、published language `AttrPaths`・`DeclaredValues`・`InitialStates` | `kernel/domain`、`kernel/infrastructure` |
| `design/usecase` | 18 | 835 | 17 | `VerifyDesignSmtUseCase`・`VerifyDesignQuintUseCase`・`ValidateDesignIrUseCase` と 7 つのポート、refinement 検査の調停 | `design/domain`、`refinement/domain`、`kernel/*` |
| `design/adapter` | 22 | 1,800 | 19 | 設計 IR パーサ、lowering 文書の描画、兄弟 entry の spawn、refinement クエリ計画（最大ファイル `refinement-query-plan.ts` 395 行）、refinement ソルバークライアント、Repository 実装 | `design/domain`、`design/usecase`、`refinement/domain`、`kernel/*`、`node:child_process`・`node:fs`・`node:os`・`node:path` |
| `refinement/domain` | 37 | 2,114 | 38 | 契約 4 の集約 `RefinementMap`、`RefinementMapDefect`、alpha 置換の計画、published language `ReqAttributeValues`。usecase／adapter は持たない | `requirements/domain`、`design/domain`、`kernel/domain`、`kernel/infrastructure` |
| `refcheck/domain` | 85 | 4,126 | 81 | `ReferenceCheckReport`、DD／CD／FD の宣言オブジェクトと不変条件としての検査 | `kernel/domain`、`kernel/infrastructure` |
| `refcheck/usecase` | 11 | 228 | 10 | `CheckDomainComponentsUseCase`・`CheckContractSummaryUseCase`・`CheckFunctionalDesignUseCase` と 2 つのポート | `refcheck/domain`、`kernel/*` |
| `refcheck/adapter` | 7 | 889 | 6 | Markdown 成果物のパーサ（component catalog、contracts table、functional design）、レポート serializer と Repository 実装 | `refcheck/domain`、`refcheck/usecase`、`kernel/*`（kernel/adapter への直接 import 16 本を含む）、`node:fs`・`node:path` |
| `doctor/domain` | 11 | 355 | 10 | `Check`、`InstallationManifest`（entry 10＋`index.ts` canary 17 の台帳）、`SolverAvailability`、`VerificationStaleness`、`CoverageState` | `kernel/domain` |
| `doctor/usecase` | 21 | 492 | 20 | 5 つの `Check*UseCase`、4 つのポート、`usecase/read-model/` のリードモデル | `doctor/domain` |
| `doctor/adapter` | 9 | 568 | 8 | harness ファイル読取、ソルバー probe（8822 の listen 判定を含む）、refcheck entry の spawn、ワークスペース走査、`DoctorPresenter` | `doctor/domain`、`doctor/usecase`、`kernel/domain`、`node:child_process`・`node:fs`・`node:os`・`node:path` |

合計: `.ts` 468 本、24,306 行（entry 787 行を含む）。`usecase/port/` は kernel・requirements・design・refcheck・doctor、`usecase/read-model/` は doctor のみ。

### deep-spec-analysis/tests

`bun:test` のスイート 23 本、`architecture/rules.ts`（18 規則）、`doubles/`、`fixtures/`（byte 凍結 golden）、`parity/`。`tools/` へは facade の import、entry の spawn、`data/*.json` の読取、intent-e2e（sandbox に compose した `.claude/tools/*.ts` の実射）、manifest の canary 検査で到達する（経路の一覧は `code-quality-assessment.md`）。依存先: `deep-spec-analysis/tools`、`aidlc-workflows/dist/claude`（intent-e2e）、`aidlc-workflows/core/tools/aidlc-plugin-validate.ts`（plugin.test）。

### deep-spec-analysis/scripts

`install.ts`（build → upgrade refresh → tombstone → compose → doctor 実行）と `smt-stress.ts`。依存先: `aidlc-workflows/core/tools/aidlc-plugin-build.ts`、`deep-spec-analysis/tools/deep-spec-analysis-doctor.ts`（パス文字列で spawn）。

### deep-spec-analysis/sensors

センサー manifest 9 本。`command` が `tools/<entry>.ts` を `.ts` 固定で指す。依存先: `deep-spec-analysis/tools`（パス文字列）。

### deep-spec-analysis/knowledge

IR／設計 IR／refinement map の著述ガイド 3 本。`tools/data/deep-spec-ir-schema.json` をパス参照する（`data/` は残るので本 intent では不変）。依存先: `deep-spec-analysis/tools/data`。

### deep-spec-analysis/stages

プラグインが追加する 2 ステージ（2.35 `deep-spec-analysis-verify`、3.55 `deep-spec-analysis-functional-verify`）。`sensors:` でセンサー id を束ね、functional-verify の本文に refcheck の手打ちコマンド例（`.ts`）がある。依存先: `deep-spec-analysis/sensors`（id）、`deep-spec-analysis/knowledge`。

### deep-spec-analysis/contributions

コアステージ `domain-design`・`contract-design`・`functional-design` への overlay 3 本。`adds.sensors` で refcheck センサーを注入する。`tools/` パスは含まない。依存先: `deep-spec-analysis/sensors`（id）。

### deep-spec-analysis/docs

`decisions.md`／`decisions.ja.md`（設計判断記録、`tools/` 言及 12 箇所は歴史記述）、`handoffs/71-tda-program.ja.md`。依存先: なし（参照専用）。

### deep-spec-analysis/package.json

開発用ハーネスの定義（`deep-spec-analysis-plugin-dev`、private、devDependencies 4 本、`workspaces` 無し）。出荷単位ではない。依存先: `technology-stack.md` の 4 パッケージ。

### deep-spec-analysis/bunfig.toml

`[test]` のカバレッジ床 0.9 と除外パターン（`tools/` 起点）。`[install]` 無し。依存先: `deep-spec-analysis/tools`（パスパターン）。

### deep-spec-analysis/tsconfig.json

型検査設定（`moduleResolution: bundler`、`noEmit`、`strict`、`include` は `scripts/`・`tools/`・`tests/`）。依存先: `deep-spec-analysis/tools`・`tests`・`scripts`（glob）。

### deep-spec-analysis/README.md

利用者向けの構成表と導入手順（`README.ja.md` と対）。`tools/` のパスを表で列挙する。依存先: なし（記述のみ）。

## 健全性評価

`architecture-guide.md` の synthesis checklist に従い、healthy／at-risk／degraded で評価する。評価は「本 intent（src/ 分離＋bundle 化）に対して」の観点。

| コンポーネント | 評価 | 根拠 |
|---|---|---|
| 17 層ディレクトリ（`kernel`〜`doctor`） | healthy | facade 完備、非循環、God ファイル無し、`process.*`／I/O が層に漏れていない。直接 import 23 本は機械的に facade へ付け替え可能 |
| `entry` | healthy（変更面の中心） | 設計どおり配線だけを持つ。bundle の入口として要件を満たす一方、`.ts` 固定パス（兄弟 entry、`childHostPath`）と `import.meta.url` 相対の `data/` 探索を持つ |
| `data` | healthy | 不変。bundle の隣に残す前提がスパイクで実証済み |
| `deep-spec-analysis/tests` | at-risk | `walkToolsFiles` の symlink 拒否と `node_modules` 非除外、spawn 先 `.ts` 9 箇所、intent-e2e の canary 20 件、`doctor-domain.test.ts` 4 件が src/ 化・bundle 化で書き換えになる |
| `deep-spec-analysis/scripts` | at-risk | `install.ts` の refresh／tombstone がファイル単位・非再帰で、bundle 化後に `.ts` 468 本を孤児化させる |
| `deep-spec-analysis/sensors`、`stages` | at-risk | `command` と手打ちコマンド例が `.ts` 固定 |
| `bunfig.toml`、`tsconfig.json` | at-risk | `tools/` 起点のパターン。src/ に移すと床と型検査の対象がずれる |
| `contributions`、`knowledge`、`docs`、`README.md`、`package.json` | healthy | 本 intent では不変または軽微な表の更新のみ（`package.json` は `workspaces` と `[install]` の追加が必要） |

## 関連成果物

- 依存エッジの全表・直接 import 23 本・配布時の依存前提: `dependencies.md`
- 負債 14 項目とリスク 9 項目: `code-quality-assessment.md`
- 各層の公開型: `api-documentation.md`
