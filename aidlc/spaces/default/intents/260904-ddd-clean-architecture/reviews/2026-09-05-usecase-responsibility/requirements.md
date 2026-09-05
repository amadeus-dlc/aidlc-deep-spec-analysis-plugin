# 要件ユースケースの責務監査

## 対象と判定基準

- 基線: `e743b4e`。作業ツリー `53a0530` の対象ソースは基線と一致していることを親エージェントが確認済み。
- 対象: `deep-spec-analysis/src/requirements/usecase/` の全20ファイル（19 TypeScriptファイルと `package.json`）。
- 実施内容: ソース、関連ドメイン、呼び出し元のアダプタ、既存テストの読み取り。ソースの変更とテスト実行は行っていない。
- 判定: ユースケースはI/Oとフローを調整し、業務上の判断・加工・演算をドメインへ委譲する。外部形式への値抽出・変換はインターフェイスアダプタが担当する。
- 参照規律: `use-case-rules.md`、`tell-dont-ask.md`、`command-query-separation.md`、`domain-services.md`（いずれも `aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/`）。

3つのユースケースすべてに責務漏出がある。特に `ValidateIntermediateRepresentationUseCase` は、取得した材料から値を取り出し、検査の適用条件・診断順・最終判定まで組み立てている。

`Result.value` 単独は汎用Resultの成功値の取り出しであり、ドメイン内部のプリミティブ値抽出と同一ではない。`supportsMajor()` のような意味ある問い合わせも、それ自体はドメインへの委譲である。以下では、その後にユースケースがどの判断・組み立てを主導しているかを指摘する。

## 指摘一覧

| ID | 優先度 | 確信度 | 内容 |
| --- | --- | --- | --- |
| RQ-1 | P1 | 高 | バージョン適合・検査適用条件・診断集約・pass判定をユースケースが所有している |
| RQ-2 | P1 | 高 | 逆参照とsource anchoringの照合手順を、複数集約の値抽出から再構成している |
| RQ-3 | P2 | 高 | 検証準備と降格reportの選択がユースケースに残り、modelとhashを別々に供給させている |
| RQ-4 | P2 | 高 | backend結果を解体し、解釈からreport形成までユースケースが組み立てている |
| RQ-5 | P2 | 高 | 保存済みreportを外部出力用のプリミティブDTOへ変換している |
| RQ-6 | P2 | 高 | 最終化済み候補の存在保証が漏れ、到達不能な状態をI/O失敗へ変換している |

優先度は設計是正の順序である。実行時の誤判定を再現したという意味ではない。

## RQ-1: バージョン適合・診断集約・pass判定

**根拠**: [validate-intermediate-representation-usecase.ts:43](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/validate-intermediate-representation-usecase.ts#L43)。

処理は以下のようにユースケース内で完結している。

1. `materials.irVersion().majorVersion()` でnumberを取り出す（44行）。
2. `Number.isInteger(major)` と対応majorの比較を行う（45行）。
3. `irVersion().asString()` を使い、不適合の診断文言を生成する（47行）。
4. `schemaErrors().toArray().map(message => message.asString())` で型付き診断を裸の `string[]` へ戻す（50行）。
5. `errors.length === 0` で後続検査の実施可否を決め、最後にも同じ式でpassを導く（58行・71行）。

現在の所有者はユースケースである。適合判定と検査途中状態の所有者は既存の `IntermediateRepresentationValidationMaterials` が適切であり、診断と判定を一緒に保持するドメイン結果へ閉じるべきである。外部出力への文字列化はadapterへ移す。

再利用できる既存APIは [IntermediateRepresentationVersion.supportsMajor():33](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/kernel/domain/intermediate-representation-version.ts#L33) と [IntermediateRepresentationModelDeclaration.wellFormednessErrors():48](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/intermediate-representation-model-declaration.ts#L48)。`Number.isInteger` の防御をusecaseへ残すのでなく、型付きバージョンの契約と適合判断へまとめる。

関連テストは [ir-validation.test.ts:205](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L205)（正常）、[同:248](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L248)（取得失敗の先行）、[同:281](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L281)（major診断がschema診断に先行）。これらは挙動を固定するが、判断の所有層までは検証していない。

## RQ-2: 逆参照とsource anchoringの照合

**根拠**: [validate-intermediate-representation-usecase.ts:57](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/validate-intermediate-representation-usecase.ts#L57)。

ユースケースは材料からview・参照索引・宣言digestを取得し、要件文書からknownIds・実測digestを取り出す。さらに `index.missingErrors(source.value.knownIds())` と `SourceAnchor.of(materials.declaredDigest(), source.value.digest()).errors()` を呼んで診断を連結している（66〜67行）。要件文書を取得できない場合の業務診断文言も64行にある。

意味検査、逆参照、source anchoringをどの条件・順序で適用するか、診断をどの順に並べるかはドメイン上の検査契約である。現在の `IntermediateRepresentationValidationMaterials` は材料をgetterで提供し、この契約を完結する操作を持っていない。

所有者は `IntermediateRepresentationValidationMaterials` またはその検査途中結果とし、取得後の `RequirementsSource` を丸ごと渡して照合を依頼できるようにする。Repositoryへの問い合わせはユースケースに残す。ドメインへRepositoryを注入したり、汎用Resultに要件検証固有の処理を追加したりする必要はない。

再利用できる実装は [FunctionalRequirementReferenceIndex.missingErrors():34](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/functional-requirement-reference-index.ts#L34)、[SourceAnchor.errors():21](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/source-anchor.ts#L21)、既存のwell-formedness検査である。

関連テストは [ir-validation.test.ts:212](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L212)（意味不整合と参照）、[同:219](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L219)（digest不一致）、[同:228](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L228)（digest宣言なし）、[同:236](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts#L236)（要件文書未取得）。

## RQ-3: 検証準備とモデル情報の再供給

**根拠**: [verify-requirements-quint-usecase.ts:57](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-requirements-quint-usecase.ts#L57)、[verify-requirements-satisfiability-modulo-theories-usecase.ts:54](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-requirements-satisfiability-modulo-theories-usecase.ts#L54)。

両ユースケースは取得したmodelからhashを取り出し、対応majorを問い合わせ、その結果に基づいて降格reportとmethodを選ぶ。`supportsMajor()` 自体は意味あるドメインの問い合わせだが、検証可能性からどのreportを形成するかという一連の判断が呼び手に残っている。

さらに [VerificationReport.versionMismatch():76](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/verification-report.ts#L76) などのAPIは、modelを受けながら、そのmodelが所有するhashも別引数として要求する。ユースケースが組み合わせの整合責任を負い、別modelのhashを誤って供給できる形である。実際の不整合発生を再現したわけではない。

所有者は `RequirementsModel` の検証準備操作と、その準備結果である。実行可能な準備か、降格reportを持つ結果かを返し、ユースケースはその結果に応じてI/Oを進める。既存の `VerificationReport.versionMismatch()` などのレポート形成処理はドメイン内部で再利用できる。

関連テストは [verify-smt-pipeline.test.ts:300](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-smt-pipeline.test.ts#L300)（対応外majorとcross-check）。モデル破損時のbackend別methodは [verify-quint-pipeline.test.ts:392](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-quint-pipeline.test.ts#L392) に固定されている。

## RQ-4: backend結果の解体とreport形成

**根拠**: [verify-requirements-quint-usecase.ts:69](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-requirements-quint-usecase.ts#L69)、[verify-requirements-satisfiability-modulo-theories-usecase.ts:66](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-requirements-satisfiability-modulo-theories-usecase.ts#L66)。

Quint側は `checked.kind` ごとにreportを選択する。正常時も `checked.plan`、`compileSkips`、`method`、`runs` を取り出してinterpretへ供給し、返されたfindings/skippedとmodelのversion/hashを再びcomposeする（82〜90行）。SMT側もplan/resultを解体し、利用不能時にはplanSkippedを取り出して降格reportを作り、正常時には解釈した部品をcomposeする（67〜88行）。

構造的な要因は、振る舞いを持たず部品を公開する以下の結果契約である。

- [QuintCheckResult:3](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/port/quint-check-result.ts#L3)
- [SatisfiabilityModuloTheoriesCheck:4](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/port/satisfiability-modulo-theories-check.ts#L4)
- [SatisfiabilityModuloTheoriesSolverResult:3](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/port/satisfiability-modulo-theories-solver-result.ts#L3)

これらは [QuintClientImplementation.check():58](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/adapter/quint-client-implementation.ts#L58) と [Z3SolverClientImplementation.check():34](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/adapter/z3-solver-client-implementation.ts#L34) から返される。

所有者はbackendの意味を持つ検証結果型である。結果自身が状態分岐とreport形成を担当すれば、ユースケースは結果の内部部品を知る必要がなくなる。既存の [QuintMachinePlan.interpret():68](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/quint-machine-plan.ts#L68)、[SatisfiabilityModuloTheoriesVerificationPlan.interpret():72](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/satisfiability-modulo-theories-verification-plan.ts#L72)、各降格reportファクトリを内部実装として再利用できる。

interpret自体はすでに業務判断をドメインへ置いている正常な部分である。問題はその前後で結果の解体・再構成を呼び手へ要求している公開契約にある。

関連テストは [verify-smt-pipeline.test.ts:333](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-smt-pipeline.test.ts#L333)（利用不能とplan skip保持）、[同:375](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-smt-pipeline.test.ts#L375)（正常実行）、[verify-quint-pipeline.test.ts:409](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-quint-pipeline.test.ts#L409)（CLI利用不能）、[同:437](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-quint-pipeline.test.ts#L437)（コンパイル不能）、[同:463](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-quint-pipeline.test.ts#L463)（正常実行とmethod）。

## RQ-5: 保存済みreportの出力変換

**根拠**: [verify-requirements-quint-usecase.ts:95](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-requirements-quint-usecase.ts#L95)、[verify-requirements-satisfiability-modulo-theories-usecase.ts:93](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-requirements-satisfiability-modulo-theories-usecase.ts#L93)。

保存済みreportから `passes()`、`findingsCount()`、`skippedCount()` を取り出し、外部出力向けのプリミティブDTOを作っている。計算自体はdomainへ委譲されており、usecaseが再計算しているという指摘ではない。今回の裁定に照らし、出力変換の担当層が違う。

漏出先は [VerifyQuintOutcome:16](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-quint-outcome.ts#L16) と [VerifySatisfiabilityModuloTheoriesOutcome:13](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verify-satisfiability-modulo-theories-outcome.ts#L13)。verified枝に保存済みreportまたは意味あるドメイン結果を保持させ、adapter側で値を取り出せばよい。

既存の描画先は [aidlc-sensor-deep-spec-verify-quint.ts:128](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-verify-quint.ts#L128)、[aidlc-sensor-deep-spec-verify-smt.ts:120](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-verify-smt.ts#L120)。`ValidateIntermediateRepresentationOutcome` の `pass + errors` もRQ-1の判断と出力変換が漏れる契約である。

関連テストは [verify-quint-pipeline.test.ts:463](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-quint-pipeline.test.ts#L463)、[verify-smt-pipeline.test.ts:375](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verify-smt-pipeline.test.ts#L375)。保存されたreportと公開結果の整合を維持する必要がある。

## RQ-6: 最終化済み候補の存在保証

**根拠**: [verification-report-finalizer.ts:54](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/usecase/verification-report-finalizer.ts#L54)。

`finalizedWith()` 後のcandidateを取り出し、nullなら `io-failed` を生成している。コメントも到達不能と明記しているが、store成功後に「no finalization candidate」というI/O失敗を作る経路になっている。

[VerificationDirectory.finalizedWith():79](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/verification-directory.ts#L79) は候補を設定する一方、[candidate():142](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/requirements/domain/verification-directory.ts#L142) は未最終化と同じnullable型を返す。候補存在の保証がドメインの公開面に表れていない。

所有者は `VerificationDirectory` の最終化操作またはその結果型である。最終化済み候補の存在を保証し、契約違反はpanicとして扱う。RepositoryErrorへ変換しない。現在のload→ドメインの最終化操作→storeというFinalizerの調整責務は維持する。CQSの既存例外として、保存した候補を返す契約まで破壊する必要はない。

関連テストは [verification-report-finalization.test.ts:192](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verification-report-finalization.test.ts#L192)（同じschemaでの適合）、[同:232](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verification-report-finalization.test.ts#L232)（兄弟取得失敗）、[同:264](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verification-report-finalization.test.ts#L264)（保存失敗）、[同:426](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verification-report-finalization.test.ts#L426)（モデル不読時のcross-check除去）。候補欠落の実発生を再現したという指摘ではない。

## ファイル単位の監査完了表

以下は `src/requirements/usecase/` 起点の全19 TypeScriptファイルである。

| ファイル | 分類 | 判定 |
| --- | --- | --- |
| `verify-requirements-quint-usecase.ts` | ユースケース | RQ-3・RQ-4・RQ-5。取得失敗、保存失敗の伝播とI/O起動は正常 |
| `verify-requirements-satisfiability-modulo-theories-usecase.ts` | ユースケース | RQ-3・RQ-4・RQ-5。同上 |
| `validate-intermediate-representation-usecase.ts` | ユースケース | RQ-1・RQ-2。取得とnot-foundのフロー分岐は正常 |
| `verification-report-finalizer.ts` | application collaborator | RQ-6。取得・ドメインへの委譲・保存の調整は正常 |
| `port/quint-check-result.ts` | backend結果のデータ契約 | RQ-4の構造的要因 |
| `port/satisfiability-modulo-theories-check.ts` | backend結果のデータ契約 | RQ-4の構造的要因 |
| `port/satisfiability-modulo-theories-solver-result.ts` | backend結果のデータ契約 | RQ-4の構造的要因 |
| `verify-quint-outcome.ts` | 出力DTO | RQ-5の漏出先 |
| `verify-satisfiability-modulo-theories-outcome.ts` | 出力DTO | RQ-5の漏出先 |
| `validate-intermediate-representation-outcome.ts` | 出力DTO | RQ-1の判断・出力変換が漏れる契約 |
| `port/formal-model-repository.ts` | Repository interface | 取得・保存契約。判断・加工の実装なし |
| `port/intermediate-representation-validation-materials-repository.ts` | Repository interface | 取得・保存契約。判断・加工の実装なし |
| `port/requirements-source-repository.ts` | Repository interface | 取得・保存契約。判断・加工の実装なし |
| `port/verification-directory-repository.ts` | Repository interface | 取得・保存契約。判断・加工の実装なし |
| `port/quint-client.ts` | Client interface | modelを受けてcheckを依頼する契約。結果型の問題はRQ-4へ計上 |
| `port/z3-solver-client.ts` | Client interface | 同上 |
| `verify-requirements-quint-input.ts` | 入力DTO | ID・パスの受け渡し。判断・加工なし |
| `verify-requirements-satisfiability-modulo-theories-input.ts` | 入力DTO | 同上 |
| `index.ts` | 公開export | export列挙のみ |

`package.json` も確認済み。依存はkernel-domain、kernel-infrastructure、kernel-usecase、requirements-domainで、adapter実装への依存はない。

## 補足: getter検出と責務監査の区別

カスタムリンターの判定材料として、以下を区別できる。

| 実例 | 分類 | 判定上の注意 |
| --- | --- | --- |
| `model.irHash()` | 単純field getter | VOを返していても内部値の抽出。`return this.#irHash` を宣言から検出できる |
| `materials.view()`、`schemaErrors()` | 単純field getter | 名前にgetがなくても同じ構造 |
| `report.id().directory()` | getterの連鎖 | I/O識別子の受け渡しでも、getter禁止規則では検出対象。リンターが独自に免除しない |
| `toArray()`、`asString()` | 表現への変換 | 呼び先がfield返却なら構造で判定できる |
| `VerificationReport.method()` | conversion中継 | `return this.#method.asString()`。呼び先の再帰分類が必要 |
| `majorVersion()` | 表現の分解・数値化 | `split/parseInt`を含む。処理を持つことだけで業務操作とは判定できない |
| `supportsMajor()` | 意味あるpredicate | 引数とmajorの等値比較。getter規則では許可できる |
| `passes()` | 意味あるpredicate | `isEmpty()`を介した件数と0の比較。boolean返却だけで許可せず実装を確認する |
| `interpret()`、`finalizedWith()` | ドメイン操作 | 判断・ドメイン結果形成を担当する。操作自体は正常 |
| `acquired.value`、`checked.plan` | Result／port結果のデータ属性 | メソッド呼び出しではない。domain getterと別分類にする |

`findingsCount()`、`skippedCount()` はコレクションのcountを中継する導出getterであり、private配列のlengthへ遡れる。一方で `isEmpty()` は比較結果を意味として返す。引数数、命名、返値がbooleanかどうかだけでは適切に区別できない。

getter呼び出しをなくしても、結果データ属性を解体して業務判断を組み立てるコードは残りうる。getter検出は再発防止の一部であり、業務判断の所有者に関する監査全体を置き換えるものではない。
