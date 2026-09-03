# deep-spec-analysis — API ドキュメント

## Focused scan 更新: installer／update／release 契約

### 現行 installer CLI

`bun deep-spec-analysis/scripts/install.ts --project <path>` を入口とし、`--project`（必須）、`--harness <name>`、`--dry-run`、`--skip-build`、`--help` を受ける。未知の引数は入力エラーで停止する。現行 source は実行中 checkout の plugin root に固定され、build／dry-run／target mapping は sibling `aidlc-workflows/core/tools` に依存する。`--from`、`--ref`、`--tag`、`--update` はまだ存在しない。

### 目標 source selector と update API

状態ファイルで確定している選択優先度は `--from <local checkout> > --ref <branch> > --tag <tag> > 無指定（GitHub tags API の semver 最大）`。remote source は tarball を一時ディレクトリ内の `deep-spec-analysis/` に展開し、導入先 `<project>/<harness>/tools/aidlc-plugin-build.ts` で build する。builder が無い場合は、利用先に本家 AI-DLC が未導入であることを案内し、target を変更せず停止する。

ただし次は未確定で、実装時に CLI contract として固定する必要がある。

- selector の複数指定を拒否するか、優先順位どおり採用するか
- `--from` が workspace root と plugin root のどちらを受けるか
- slash を含む ref、semver prerelease、tags API pagination、HTTP timeout／retry
- local／mutable branch／fixed tag ごとの `--update` の再解決規則

### 目標 provenance filesystem contract

保存先は `<harness>/tools/data/deep-spec-analysis-install.json`。予定フィールドは `version`、`ref`、`source`、`installed_at`、`payload_sha256` で、compose 成功後にだけ atomic write する。これは plugin payload ではなく installer 管理メタデータなので `contributes.tools` と tombstone の対象外とする。同版の `--update` はこのファイルを書き直す前に no-op し、Changed 0 を維持する。schema version、source の正規形、payload digest の対象集合と canonicalization はまだ未確定である。

### 目標 release CLI

`scripts/release.ts` は未実装。単なる version bump → tag → push では manifest の変更が tag に入らないため、clean tree／branch 検査、manifest 更新、commit、`v<version>` tag、commit と tag の push、途中失敗時の復旧案内を一つの契約として定義する必要がある。GitHub Release asset は本 intent の対象外。

### doctor 互換性

現行 doctor の出力は `{ "checks": [{ "pass", "label", "fix?", "severity?" }] }` で、`skip`／`status` フィールドは無い。ネットワーク不通を「skip」として表現する際に新フィールドを足すと host contract が変わるため、既存 shape 内で advisory を表すか、明示的な契約変更として扱う。以下の既存センサー／doctor API 全体は前回 store 由来で、今回再検証したのは doctor の installation 関連型・entry・presenter と installer からの呼び出し境界である。

外部面（センサー CLI・doctor CLI・子プロセス協定・契約スキーマ・環境変数）と内部面（各層 facade の公開型・ユースケース）。出典は developer link の handoff と `sensors/*.md` の frontmatter、各 `index.ts` の再輸出一覧。**外部面の項目と文言は外部仕様として不変**（`docs/decisions.ja.md` の裁定）。

## 外部面 1: センサー CLI（entry 9 本）

| センサー id | entry | `matches` | 出力 findings | `timeout_seconds` |
|---|---|---|---|---|
| `deep-spec-ir-valid` | `tools/aidlc-sensor-deep-spec-ir-valid.ts` | `**/deep-spec-analysis-formal-model.md` | （verdict のみ） | 15 |
| `deep-spec-verify-smt` | `tools/aidlc-sensor-deep-spec-verify-smt.ts` | `**/deep-spec-analysis-formal-model.md` | `deep-spec-verify/smt.json`、`cross-check.json` | 75 |
| `deep-spec-verify-quint` | `tools/aidlc-sensor-deep-spec-verify-quint.ts` | `**/deep-spec-analysis-formal-model.md` | `deep-spec-verify/quint.json`、`cross-check.json` | 75 |
| `deep-spec-refcheck-domain` | `tools/aidlc-sensor-deep-spec-refcheck-domain.ts` | `**/components.md` | `deep-spec-refcheck/components.json` | 10 |
| `deep-spec-refcheck-contract` | `tools/aidlc-sensor-deep-spec-refcheck-contract.ts` | `**/contract-summary.md` | `deep-spec-refcheck/contract-summary.json` | 10 |
| `deep-spec-refcheck-functional` | `tools/aidlc-sensor-deep-spec-refcheck-functional.ts` | `**/functional-design/*.md` | `deep-spec-refcheck/functional-design.json` | 10 |
| `deep-spec-design-ir-valid` | `tools/aidlc-sensor-deep-spec-design-ir-valid.ts` | `**/deep-spec-analysis-functional-formal-model.md` | （verdict のみ） | 15 |
| `deep-spec-design-verify-smt` | `tools/aidlc-sensor-deep-spec-design-verify-smt.ts` | `**/deep-spec-analysis-functional-formal-model.md` | `deep-spec-design-verify/smt.json` | 75 |
| `deep-spec-design-verify-quint` | `tools/aidlc-sensor-deep-spec-design-verify-quint.ts` | `**/deep-spec-analysis-functional-formal-model.md` | `deep-spec-design-verify/quint.json` | 85 |

共通契約:

- **起動**: manifest の `command: bun {{HARNESS_DIR}}/tools/<entry>.ts`（9 本すべて `.ts` 固定、`kind: deterministic`、`default_severity: advisory`、`category: document-shape`）。ディスパッチャが `--stage <slug> --output-path <path>` を渡す。refcheck 3 本は `--report-only`（doctor の構造負債スキャン用）も受ける。解釈は `kernel/adapter/sensor-flags.ts parseFlags`
- **stdout**: JSON の verdict 1 行。ir-valid 系は `{pass, findings_count, errors[]}`、それ以外は `{pass, findings_count, skipped_count, method}`。`method` は `exhaustive`（SMT）／`bounded` または `simulation`（Quint）／`static`（refcheck）。対象外の basename は `note: "not-applicable"` で素通し（`pass: true`）。ソルバー不在・タイムアウトは findings 側の `unavailable`／`skipped[]` に現れ、verdict 行は沈黙しない
- **exit code**: `0` = 判定を返した（pass／fail を問わない）、`1` = 引数不備または書込失敗、`127` = ソルバー不在
- **findings の置き場**: `--output-path` の成果物と同じ record の `<stage>/deep-spec-verify/`・`deep-spec-refcheck/`・`deep-spec-design-verify/` 配下。serializer（`*-serializer.ts`）は書き出し前に契約 2 スキーマで自己検証し、失敗すると `self-validation against deep-spec-findings-schema.json failed`
- **スキーマの解決**: 9 本とも `join(dirname(fileURLToPath(import.meta.url)), "data", "<schema>.json")` で **自分の隣の `data/`** から契約スキーマを読み、usecase に注入する。bundle 化しても bundle が `tools/` 直下にあり `data/` が隣に残る限り成立する（スパイク実測、`code-quality-assessment.md` 負債 2）

## 外部面 2: doctor CLI

- **起動**: `bun tools/deep-spec-analysis-doctor.ts`（引数なし）。`AIDLC_PROJECT_DIR`（既定 `process.cwd()`）と `AIDLC_HARNESS_DIR`（既定 `.claude`）から harness ルートを決める。`scripts/install.ts:290` もインストール末尾に spawn する
- **stdout**: `{"checks":[{pass, label, fix?, severity?}]}` を 1 行。checks の順序（manifest → solvers → 要件カバレッジ → 構造負債 → 設計カバレッジ）は凍結
- **manifest 照合**: `tools/doctor/domain/installation-manifest.ts` の `InstallationManifest.standard()` が、entry `.ts` 10 本＋各層の `index.ts` canary 17 本＋sensors／knowledge／data の存在を検査する（`tests/doctor-domain.test.ts:24-27` が固定）。**bundle 化はこの台帳と label 文言＝外部仕様の変更を伴う**（`code-quality-assessment.md` リスク 4）
- **ソルバー probe**: `<projectDir>/node_modules/z3-solver/package.json` の存在、`node`、`quint --version`、`java -version`（Apalache 検出）。`localhost:8822` に listen 中のサーバがあるときだけ trivial spec を `quint verify` して陳腐化を判定し、`Apalache available` 行を fail にして `fix` に停止手順を出す（#128）
- **構造負債**: `tools/doctor/adapter/refcheck-backend-client-impl.ts:105` が `join(root, "tools", tool)` で refcheck entry を `--report-only` で spawn する。`tool` 名は `doctor-workspace-client-impl.ts:138,140,158` の文字列 `aidlc-sensor-deep-spec-refcheck-{domain,contract,functional}.ts`

## 外部面 3: 子プロセス協定と兄弟 entry の spawn

| 協定 | 親 | 子 | 内容 |
|---|---|---|---|
| `--smt-child`（凍結） | `requirements/adapter/z3-solver-client-impl.ts:56`（`selfPath` を verify-smt entry が注入）、`design/adapter/refinement-solver-client-impl.ts:64`（`childHostPath` を design-verify-smt entry が `join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts")` で注入） | `spawnSync(runtime, [path, "--smt-child"])`。runtime は node 優先・bun フォールバック | stdin: `{queries:[{id, script, assumptions, model:[{name, sort}]}], timeoutMs, budgetMs}` → stdout: `{results:[{id, status, model?, core?}]}` または `{unavailable}` を 1 行。子側は `requirements/adapter/z3-engine-child.ts solveSmtChild` が `await import("z3-solver")` で解く |
| 兄弟 entry の spawn | `design/adapter/sibling-backend-client-impl.ts:50` | `join(toolsDirectory, "aidlc-sensor-deep-spec-verify-${backend}.ts")` を `bun` で spawn（`toolsDirectory` は design entry が注入） | lowering した契約 1 文書を渡し、返った verdict 文書（契約 2）を `parseSiblingVerdictDocument` で読み設計語彙に写像 |
| doctor → refcheck | `doctor/adapter/refcheck-backend-client-impl.ts:105` | `bun <root>/tools/aidlc-sensor-deep-spec-refcheck-*.ts --report-only` | 構造負債の report-only スキャン |
| 外部 CLI | `requirements/adapter/quint-client-impl.ts` | `quint --version`（probe）／`run`／`verify`。`spawnSync` に `killSignal: "SIGINT"`、`ETIMEDOUT` を予算超過の第一の証拠に | `java -version` は Apalache 検出。doctor の陳腐化 probe は `process.execPath -e <node:net connect 8822>` |

## 外部面 4: データ契約（`tools/data/*.json`）

| 契約 | ファイル | `title` | 主な必須項目 |
|---|---|---|---|
| 1 | `deep-spec-ir-schema.json` | Deep Spec IR (contract 1) | `irVersion`、`schema`、`obligations`、`scenarios`、`background`（＋`sourceDigest` で要件本文に固定。SMT-LIB／Quint の構文を含まない） |
| 2 | `deep-spec-findings-schema.json` | Deep Spec normalized findings (contract 2) | `backend`、`irVersion`、`irHash`、`method`、`findings`、`skipped`（正準ソート、byte 決定論、`unavailable` も明示） |
| 3 | `deep-spec-design-ir-schema.json` | Deep Spec design IR (contract 3) | ユニットごとの entities／rules／状態機械（`transitions`、`ignores[]`、`initial`）。`irKind` で契約 1 と区別 |
| 4 | `deep-spec-refinement-map-schema.json` | Deep Spec refinement map (contract 4) | ユニットごとの `attrMap`（式）／`enumMap`（全射）／`eventMap`／`unmapped[]`、要件 IR と設計 IR の 2 つの内容ハッシュ |

契約 1 と 3 の式ツリーは `kernel/domain/expression.ts` の `Expression`（published language）そのもの。LLM が読む知識ファイル `knowledge/aidlc-product-agent/deep-spec-ir-authoring.md:26` が `{{HARNESS_DIR}}/tools/data/deep-spec-ir-schema.json` を参照する。

## 外部面 5: 環境変数

すべて entry だけが読む（`process-only-in-entries` で機械検査）。

| 変数 | 読む entry | 意味 |
|---|---|---|
| `AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS` | verify-smt／design-verify-smt | z3 クエリのタイムアウト |
| `AIDLC_DEEP_SPEC_SMT_RUNTIME` | verify-smt／design-verify-smt | 子プロセスのランタイム指定（既定は node 優先・bun フォールバック） |
| `AIDLC_DEEP_SPEC_QUINT_BIN` | verify-quint／design-verify-quint／doctor | `quint` 実行ファイル（既定 `"quint"`。テストは `node_modules/.bin/quint` を注入） |
| `AIDLC_DEEP_SPEC_QUINT_METHOD` | verify-quint／design-verify-quint | `auto | bounded | simulation`（Apalache の有無で bounded／simulation を切替） |
| `AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP` | design-verify-quint | bounded モードの到達不能状態検査の予算上限 |
| `APALACHE_DIST`、`HOME` | verify-quint／design-verify-quint／doctor | Apalache 配布物の検出（`~/.quint/apalache-dist-*`） |
| `AIDLC_PROJECT_DIR`、`AIDLC_HARNESS_DIR` | doctor | harness ルートの決定 |

## 内部面: 層 facade の公開型とユースケース

各層の公開面は `index.ts` の再輸出だけ（再輸出数は `component-inventory.md`）。代表例:

| 層 | 主な公開型・関数 |
|---|---|
| `kernel/infrastructure` | `Result`／`Ok`／`Err`、`ok`、`err`、`unreachable` |
| `kernel/domain` | published language `Expression`（type）と `ExpressionTree`、表現プリミティブ `KeyedIndex`／`KeySet`、`ErrorMessages`（凍結文言）、DP: `ContentHash`・`IrVersion`・`TargetId(s)`・`FrRefs`・`BackendName`・`RequirementId(s)`・`NormalizedName`・`ArtifactPath`・`AttributeBound`・`AttributePath`・`UnitName`・`QueryLabel`・`TriggerName`、閉集合語彙: `FindingKind`（11 種と順位）・`VerificationMethod`（4 種）・`AttributeKind`・`ObligationNature` |
| `kernel/usecase` | ポート `RepositoryError`、`Clock` |
| `kernel/adapter` | `parseFlags`、`renderVerdictLine`、`findRecordRoot`／`relArtifact`／`readIfExists`、`readContractSchema`／`SchemaUnreadable`、`validateSchema`／`Schema`、`canonicalStringify`、`parseYamlSubset`、`extractFences`、`parseMarkdownTables`、`listSubdirectories`、`SystemClock`、`writeFileAtomically`、SMT-LIB 補助 `smtVar`／`smtName`／`smtLit`／`smtIntOf` |
| `requirements/domain` | 集約 `RequirementsModel`（`AttributeDeclaration(s)`・`Obligation(s)`・`Scenario(s)`・`BackgroundAssumption(s)`）、集約 `VerificationReport`（`VerificationFinding(s)`・`VerificationSkipped`／`VerificationSkips`・`VerificationWitness`・`CrossCheckedEntries`）、`SmtVerificationPlan`／`SmtQueryVerdict(s)`／`SmtEventPairProbe(s)`、`QuintMachinePlan`／`QuintMachineComponent(s)`／`QuintRuns`／`TraceState(s)`、IR 宣言 `Ir*Decl` 群、`SUPPORTED_IR_MAJOR` |
| `requirements/usecase` | ユースケース `VerifyRequirementsSmtUseCase`・`VerifyRequirementsQuintUseCase`・`ValidateIrUseCase`、ポート `FormalModelRepository`・`VerificationReportRepository`・`Z3SolverClient`・`QuintClient`・`IrValidationMaterialsRepository`・`RequirementsSourceRepository`、結果 `VerifySmtOutcome`／`VerifyQuintOutcome`／`ValidateIrOutcome` |
| `requirements/adapter` | `parseFormalModel`、`FormalModelRepositoryImpl`、`VerificationReportRepositoryImpl`、`Z3SolverClientImpl`（＋`Config`）、`buildSmtPlan`／`SmtPlan`／`SmtChildQuery`／`SmtChildResult`／`solveSmtChild`／`decodeSolverModel`、`QuintClientImpl`（＋`Config`）、`compileQuintMachine`／`CompiledQuintMachine`／`qVar`、`decodeItfTrace`／`itfStatus`、`IrValidationMaterialsRepositoryImpl`、`RequirementsSourceRepositoryImpl` |
| `design/domain` | 集約 `DesignModel`（`DesignUnit(s)`・`DesignMachine(s)`・`DesignTransition(s)`・`DesignIgnore(s)`・`DesignObligation(s)`・`DesignScenario(s)`・`DesignBackgroundAssumption(s)`）、lowering `LoweredUnit`／`LoweredObligation(s)`／`LoweredScenario(s)`／`LoweringIndex`／`LoweredOrigin`、`SiblingVerdictDocument`／`SiblingVerdictFinding(s)`／`SiblingVerdictSkip(s)`、集約 `DesignReport`（`DesignFinding(s)`・`DesignSkipped`／`DesignSkips`・`CheckedUnits`・`DesignCrossCheckedEntries`）、published language `AttrPaths`・`DeclaredValues`・`InitialStates`、`SUPPORTED_DESIGN_IR_MAJOR` |
| `design/usecase` | ユースケース `VerifyDesignSmtUseCase`・`VerifyDesignQuintUseCase`・`ValidateDesignIrUseCase`、ポート `DesignModelRepository`・`DesignReportRepository`・`SiblingBackendClient`・`RefinementMaterialsRepository`・`RefinementSolverClient`・`RefinementMapRepository`・`DesignIrValidationMaterialsRepository`、`ReachabilityProbe`／`SiblingLoweredRun`／`RefinementCheck`／`RefinementSolverResult`、結果 `VerifyDesignOutcome`／`ValidateDesignIrOutcome` |
| `design/adapter` | `parseDesignModel`／`parseDesignEntities`／`renderDesignEntities`、`DesignModelRepositoryImpl`、`renderLoweredDocument`、`SiblingBackendClientImpl`（＋`Config`）、`parseSiblingVerdictDocument`、`DesignReportRepositoryImpl`、`probeReached`／`reachabilityVariant`、`RefinementQueryPlan`／`buildRefinementQueries`／`assembleQuery`／`smtOfExpr`／`refinementSmtContext`、`RefinementMaterialsRepositoryImpl`（`REFINEMENT_MAP_BASENAME`・`REQUIREMENTS_MODEL_RELPATH`）、`RefinementSolverClientImpl`（＋`Config`）、`RefinementMapRepositoryImpl`、`DesignIrValidationMaterialsRepositoryImpl` |
| `refinement/domain` | 集約 `RefinementMap`（`RefinementUnitMap(s)`・`AttributeMapping(s)`・`EventMapping(s)`・`TransitionRef(s)`・`UnmappedDeclarations`・`UnmappedTarget(Ref)`）、ドメインエラー `RefinementMapDefect`（4 バリアント）、`RefinementRequirements`／`RefinementAttribute(s)`／`RefinementObligation(s)`／`RefinementScenario(s)`、`UnitRefinementPlan`／`RefinementStatus`／`EffectAssignments`、`DesignEventCatalog`／`DesignAssignments`／`DesignEvent`、`RefinementSolverPlan`／`RefinementProbe`／`RefinementQueryVerdict(s)`、`RefinementQuintInvariant(s)`、`RefinementMapId`／`FormalModelId`、`RefinementMaterials`／`RefinementMapAcquisition`、published language `ReqAttributeValues` |
| `refcheck/domain` | 集約 `ReferenceCheckReport`（`Finding(s)`・`Skipped`／`Skips`・`InputAnchor(s)`・`WitnessRef(s)`・`CheckFamily`／`CheckFamilies`）、DD: `Components`／`Component`／`ComponentEntity`／`ComponentRef(s)`／`EntityReference(s)`／`ComponentShapeError(s)`、CD: `ContractRow(s)`／`ContractId`／`ContractParty`／`SpecBlockAssessment(s)`／`UnitDecl(s)`、FD: 集約 `DesignRecord`（`EntityDecl(s)`・`AttrDecl(s)`・`RelDecl(s)`・`RuleDecl(s)`・`StateMachineSketch(es)`・`DeclaredEntities`・`DomainEntitySketch(es)`・`SiblingUnitIndex`・`AllowedValue(s)`）、`*Outcome` 群（`ComponentCatalogOutcome`・`ContractsTableOutcome`・`DeclaredUnitsOutcome`・`DomainEntitiesOutcome`・`EntitiesOutcome`・`FunctionalSpecOutcome`・`RulesOutcome`）、`CATALOG_VERSION`、`BlockIndex`／`LineNumber`／`FenceCount` |
| `refcheck/usecase` | ユースケース `CheckDomainComponentsUseCase`・`CheckContractSummaryUseCase`・`CheckFunctionalDesignUseCase`、ポート `ReferenceCheckReportRepository`・`DesignRecordRepository`、`CheckOutcome`／`CheckExecutionMode` |
| `refcheck/adapter` | `ReferenceCheckReportRepositoryImpl`、`conformToContract`／`renderReportBytes`、`parseComponentCatalog`、`assessSpecBlocks`／`parseContractsTable`／`parseDeclaredUnits`、`DesignRecordRepositoryImpl` |
| `doctor/domain` | `Check`／`CheckSeverity`／`HealthVerdict`、`InstallationManifest`／`ManifestEntry`／`InstalledStatus`、`SolverAvailability`、`DigestAnchor`／`VerificationStaleness`、`CoverageState` |
| `doctor/usecase` | ユースケース `CheckInstallationUseCase`・`CheckSolversUseCase`・`CheckVerificationCoverageUseCase`・`CheckStructuralDebtUseCase`・`CheckFunctionalCoverageUseCase`、ポート `HarnessFileClient`・`SolverProbeClient`・`RefcheckBackendClient`・`DoctorWorkspaceClient`、リードモデル `CoverageRow`／`CoverageAssessment`・`DebtRow`／`StructuralDebt`・`UnitCoverageRow`／`RefinementStaleRow`／`UnitCoverage`、`VerificationTarget`／`DesignArtifactRef`／`FunctionalUnitScan`／`FunctionalTarget` |
| `doctor/adapter` | `HarnessFileClientImpl`、`SolverProbeClientImpl`（＋`Config`）、`RefcheckBackendClientImpl`（＋`Config`）、`DoctorWorkspaceClientImpl`（＋`Config`）、`DoctorPresenter` |

domain の公開 interface は `kernel/domain/expression.ts` の `Expression` だけ（`tests/architecture.test.ts` が固定）。テストは facade 以外を import しない（`tests/doubles/` 2 本を含め、`../tools/<ctx>/<layer>/index.ts` 経由のみ）。

## 関連成果物

- 層の責務と数字: `component-inventory.md`
- 層間依存と直接 import 23 本: `dependencies.md`
- テスト側の到達経路と `.ts` 固定パスの散在: `code-quality-assessment.md`
