# ドメイン全体の構築・所有権・命名の再監査

## 是正した境界

未検証の構築引数はDeclarationParam、検証済みの値はDeclarationクラスとして分離した。Declarationがサイズ・深さ・総量・数値の有限性とスナップショットの所有権を守る。DeclaredBindingValueのconstructor/ofはDeclarationだけを受け取り、生のJSONや型別名を受ける旧APIを削除した。失敗はDeclaration.parseでParseErrorへ変換する。

assertValueSize→structuredCloneという二度読みの経路を削除し、boundedValueSnapshotでサイズを制限しながら読み取った値を保持する。宣言、トレース、要件・設計の証拠、式、属性写像、スキーマへ適用した。数値や型をunknownへ広げず、型付きの境界データを扱う。属性写像の検証も名前付きファクトリからコンストラクタへ移した。

## constructor / of / parse

310個のコンストラクタを調べた。直接throw、共通スナップショット処理、別のVOのofへの委譲をたどり、110種類に契約違反の経路があることを確認した。この110種類にはすべて公開parseがあり、欠落は0件である。ソース構造の監査はtests/architecture/construction-contracts.tsとarchitecture.test.tsで再実行する。リフレクションでVO内部値を調べるテストではなく、生成APIの構造に対する監査である。

ErrorMessages、FunctionalRequirementReferences、BusinessRuleReferences、EnumerationMembers、InitialStates、DeclaredBindings、ScenarioBindingsは、要素の検証後にコレクションのparseも通す。flatMapResultで両方のResultを合成し、ofの例外をcatchして入力エラーに変換する経路は作らない。エンティティや複合VOの通常の読込でも、失敗しうる構築はparseを使う。

単純引数はnumber・string・具体的なVOを明記した。constructorのParameters<typeof X.of>[0]は除去し、複合引数は未検証のXParamとしてof/parseと共有する。constructor/of/parse本体は複数行表記に統一した。82コレクションで配列の所有権確保をコンストラクタへ移した。型付きの部品しか受け取らず契約違反を送出しないコンストラクタには、形だけのparseを追加しない。

## 統合と削除

要件・設計に分散していた4種類の列挙値コレクションをEnumerationMembersへ統合した。AttributeValues、IrDeclaredValues、DeclaredValues、ReqAttributeValuesの実装とexportは削除し、旧名のwrapper/aliasは残していない。ofBoolean/ofNumber/ofLiteral等の単なる引数別の生成口と、ofModelの個別表記も廃止し、of/parseへ揃えた。公開JSONキーとセンサー名はPublished Languageとして保持する。

## 型名の確認

型名188件と内部ファイル154件を改名した。Ir→IntermediateRepresentation、Br→BusinessRule、Attr→Attribute、Req→Requirement、Decl→Declaration、Ref→Reference、Id→Identifier、Smt→SatisfiabilityModuloTheories、Impl→Implementation等へ展開した。Json/Yamlは境界形式の技術語、Z3/Quintは製品・言語名、Paramは未検証引数という明示的な区別に使う。生の型別名をVOとして扱わない。

省略語の型名とparse欠落には、それぞれ違反例・正常例と実ソース全件への監査テストを置いた。個別修正の記憶や目視だけに依存しない。

## 検証

- 公開APIを使うDeclaration/所有権のテスト、コレクション生成のテスト、30種類の委譲された生成失敗のテストを追加した。
- 全体: **872成功、1スキップ、0失敗。873テスト、43ファイル、終了コード0**。
- TypeScript型検査と生成14ファイルの同期に成功。
- lcov合算line coverage: **99.86654804270462%（8980 / 8992）**。しきい値・除外は変更していない。
- 発生源の認証をVO単体で行ったことにはしない。内容一致と送信元の正当性を区別する。
- 正常系golden、公開契約スキーマ、aidlc-workflows submoduleを変更していない。

## 契約違反経路を持つ型

| 型 | ソース | parse |
| --- | --- | --- |
| AllowedValue | refcheck/domain/allowed-value.ts | あり |
| AppliesTo | refcheck/domain/applies-to.ts | あり |
| ArtifactPath | kernel/domain/artifact-path.ts | あり |
| AttributeBound | kernel/domain/attribute-bound.ts | あり |
| AttributeDefault | refcheck/domain/attribute-default.ts | あり |
| AttributeKind | kernel/domain/attribute-kind.ts | あり |
| AttributeMapping | design/domain/attribute-mapping.ts | あり |
| AttributeName | refcheck/domain/attribute-name.ts | あり |
| AttributePath | kernel/domain/attribute-path.ts | あり |
| BackendName | kernel/domain/backend-name.ts | あり |
| BackgroundAssumption | requirements/domain/background-assumption.ts | あり |
| BackgroundAssumptionIdentifier | requirements/domain/background-assumption-identifier.ts | あり |
| BindingValue | kernel/domain/binding-value.ts | あり |
| BlockIndex | refcheck/domain/block-index.ts | あり |
| BusinessRuleIdentifier | refcheck/domain/business-rule-identifier.ts | あり |
| BusinessRuleReference | design/domain/business-rule-reference.ts | あり |
| BusinessRuleReferences | design/domain/business-rule-references.ts | あり |
| CardinalityNotation | refcheck/domain/cardinality-notation.ts | あり |
| CheckFamily | refcheck/domain/check-family.ts | あり |
| ComponentName | refcheck/domain/component-name.ts | あり |
| ContentHash | kernel/domain/content-hash.ts | あり |
| ContractIdentifier | refcheck/domain/contract-identifier.ts | あり |
| ContractParty | refcheck/domain/contract-party.ts | あり |
| Declaration | kernel/domain/declaration.ts | あり |
| DeclaredBindings | kernel/domain/declared-bindings.ts | あり |
| DeclaredDigest | kernel/domain/declared-digest.ts | あり |
| DeclaredRuleIdentifier | refcheck/domain/declared-rule-identifier.ts | あり |
| DesignAssignments | design/domain/design-assignments.ts | あり |
| DesignAttributeName | design/domain/design-attribute-name.ts | あり |
| DesignBackgroundAssumption | design/domain/design-background-assumption.ts | あり |
| DesignBackgroundDeclaration | design/domain/design-background-declaration.ts | あり |
| DesignBackgroundIdentifier | design/domain/design-background-identifier.ts | あり |
| DesignEntityName | design/domain/design-entity-name.ts | あり |
| DesignEvent | design/domain/design-event.ts | あり |
| DesignInputAnchor | design/domain/design-input-anchor.ts | あり |
| DesignMachineIdentifier | design/domain/design-machine-identifier.ts | あり |
| DesignObligation | design/domain/design-obligation.ts | あり |
| DesignObligationDeclaration | design/domain/design-obligation-declaration.ts | あり |
| DesignObligationIdentifier | design/domain/design-obligation-identifier.ts | あり |
| DesignObligationNature | design/domain/design-obligation-nature.ts | あり |
| DesignObligationOrigin | design/domain/design-obligation-origin.ts | あり |
| DesignScenario | design/domain/design-scenario.ts | あり |
| DesignScenarioDeclaration | design/domain/design-scenario-declaration.ts | あり |
| DesignScenarioIdentifier | design/domain/design-scenario-identifier.ts | あり |
| DesignTransition | design/domain/design-transition.ts | あり |
| DesignTransitionDeclaration | design/domain/design-transition-declaration.ts | あり |
| DesignTransitionIdentifier | design/domain/design-transition-identifier.ts | あり |
| DesignUnit | design/domain/design-unit.ts | あり |
| DesignUnitIdentifier | design/domain/design-unit-identifier.ts | あり |
| DesignWitness | design/domain/design-witness.ts | あり |
| EffectAssignments | design/domain/effect-assignments.ts | あり |
| ElementPath | refcheck/domain/element-path.ts | あり |
| EntityName | refcheck/domain/entity-name.ts | あり |
| EnumerationMember | kernel/domain/enumeration-member.ts | あり |
| EnumerationMembers | kernel/domain/enumeration-members.ts | あり |
| ErrorMessage | kernel/domain/error-message.ts | あり |
| ErrorMessages | kernel/domain/error-messages.ts | あり |
| ExpressionTree | kernel/domain/expression-tree.ts | あり |
| FenceCount | refcheck/domain/fence-count.ts | あり |
| FindingKind | kernel/domain/finding-kind.ts | あり |
| FindingsSchema | kernel/domain/findings-schema.ts | あり |
| FunctionalRequirementReferences | kernel/domain/functional-requirement-references.ts | あり |
| InitialState | design/domain/initial-state.ts | あり |
| InitialStates | design/domain/initial-states.ts | あり |
| InputAnchor | refcheck/domain/input-anchor.ts | あり |
| IntermediateRepresentationAttributeName | requirements/domain/intermediate-representation-attribute-name.ts | あり |
| IntermediateRepresentationBackgroundDeclaration | requirements/domain/intermediate-representation-background-declaration.ts | あり |
| IntermediateRepresentationEntityName | requirements/domain/intermediate-representation-entity-name.ts | あり |
| IntermediateRepresentationObligationDeclaration | requirements/domain/intermediate-representation-obligation-declaration.ts | あり |
| IntermediateRepresentationScenarioDeclaration | requirements/domain/intermediate-representation-scenario-declaration.ts | あり |
| IntermediateRepresentationTemporalDeclaration | requirements/domain/intermediate-representation-temporal-declaration.ts | あり |
| IntermediateRepresentationVersion | kernel/domain/intermediate-representation-version.ts | あり |
| LineNumber | refcheck/domain/line-number.ts | あり |
| LoweredBackground | design/domain/lowered-background.ts | あり |
| LoweredIdentifier | design/domain/lowered-identifier.ts | あり |
| LoweredObligation | design/domain/lowered-obligation.ts | あり |
| LoweredOriginReference | design/domain/lowered-origin-reference.ts | あり |
| LoweredScenario | design/domain/lowered-scenario.ts | あり |
| MachineSpecification | refcheck/domain/machine-specification.ts | あり |
| NormalizedName | kernel/domain/normalized-name.ts | あり |
| NumericBound | refcheck/domain/numeric-bound.ts | あり |
| Obligation | requirements/domain/obligation.ts | あり |
| ObligationIdentifier | requirements/domain/obligation-identifier.ts | あり |
| ObligationNature | kernel/domain/obligation-nature.ts | あり |
| PluginVersion | doctor/domain/plugin-version.ts | あり |
| QueryLabel | kernel/domain/query-label.ts | あり |
| QuintMachineComponent | requirements/domain/quint-machine-component.ts | あり |
| ReferenceTarget | refcheck/domain/reference-target.ts | あり |
| RefinementObligation | design/domain/refinement-obligation.ts | あり |
| RefinementQueryVerdict | design/domain/refinement-query-verdict.ts | あり |
| RefinementQuintInvariant | design/domain/refinement-quint-invariant.ts | あり |
| RequirementIdentifier | kernel/domain/requirement-identifier.ts | あり |
| RuleCategory | refcheck/domain/rule-category.ts | あり |
| SatisfiabilityModuloTheoriesQueryVerdict | requirements/domain/satisfiability-modulo-theories-query-verdict.ts | あり |
| Scenario | requirements/domain/scenario.ts | あり |
| ScenarioBindings | kernel/domain/scenario-bindings.ts | あり |
| ScenarioIdentifier | requirements/domain/scenario-identifier.ts | あり |
| SkipReason | kernel/domain/skip-reason.ts | あり |
| SourceIdentifier | refcheck/domain/source-identifier.ts | あり |
| StateName | refcheck/domain/state-name.ts | あり |
| TargetIdentifier | kernel/domain/target-identifier.ts | あり |
| TraceValue | requirements/domain/trace-value.ts | あり |
| TransitionReference | design/domain/transition-reference.ts | あり |
| TriggerName | kernel/domain/trigger-name.ts | あり |
| TypeName | refcheck/domain/type-name.ts | あり |
| UnitName | kernel/domain/unit-name.ts | あり |
| UnmappedTargetReference | design/domain/unmapped-target-reference.ts | あり |
| VerificationMethod | kernel/domain/verification-method.ts | あり |
| VerificationWitness | requirements/domain/verification-witness.ts | あり |
| WitnessReference | refcheck/domain/witness-reference.ts | あり |

## 型名変更一覧

| 変更前 | 変更後 |
| --- | --- |
| AttrDecl | AttributeDeclaration |
| AttrDeclParam | AttributeDeclarationParam |
| AttrDecls | AttributeDeclarations |
| AttributeDeclaration | RequirementAttributeDeclaration |
| AttributeDeclarationParam | RequirementAttributeDeclarationParam |
| AttributeDeclarations | RequirementAttributeDeclarations |
| AttrPaths | AttributePaths |
| BackgroundAssumptionId | BackgroundAssumptionIdentifier |
| BrRef | BusinessRuleReference |
| BrReferenceIndex | BusinessRuleReferenceIndex |
| BrRefs | BusinessRuleReferences |
| BusinessRuleId | BusinessRuleIdentifier |
| ComponentRef | ComponentReference |
| ComponentRefParam | ComponentReferenceParam |
| ComponentRefs | ComponentReferences |
| ContractId | ContractIdentifier |
| DeclaredRuleId | DeclaredRuleIdentifier |
| DesignArtifactRef | DesignArtifactReference |
| DesignAttributeDecl | DesignAttributeDeclaration |
| DesignAttributeDeclParam | DesignAttributeDeclarationParam |
| DesignAttributeDecls | DesignAttributeDeclarations |
| DesignBackgroundDecl | DesignBackgroundDeclaration |
| DesignBackgroundDeclParam | DesignBackgroundDeclarationParam |
| DesignBackgroundDecls | DesignBackgroundDeclarations |
| DesignBackgroundId | DesignBackgroundIdentifier |
| DesignEntityDecl | DesignEntityDeclaration |
| DesignEntityDeclParam | DesignEntityDeclarationParam |
| DesignEntityDecls | DesignEntityDeclarations |
| DesignIgnoreDecl | DesignIgnoreDeclaration |
| DesignIgnoreDeclParam | DesignIgnoreDeclarationParam |
| DesignIgnoreDecls | DesignIgnoreDeclarations |
| DesignIrValidationMaterials | DesignIntermediateRepresentationValidationMaterials |
| DesignIrValidationMaterialsConfig | DesignIntermediateRepresentationValidationMaterialsConfiguration |
| DesignIrValidationMaterialsId | DesignIntermediateRepresentationValidationMaterialsIdentifier |
| DesignIrValidationMaterialsParam | DesignIntermediateRepresentationValidationMaterialsParam |
| DesignIrValidationMaterialsRepository | DesignIntermediateRepresentationValidationMaterialsRepository |
| DesignIrValidationMaterialsRepositoryImpl | DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation |
| DesignMachineDecl | DesignMachineDeclaration |
| DesignMachineDeclParam | DesignMachineDeclarationParam |
| DesignMachineDecls | DesignMachineDeclarations |
| DesignMachineId | DesignMachineIdentifier |
| DesignModelId | DesignModelIdentifier |
| DesignModelRepositoryImpl | DesignModelRepositoryImplementation |
| DesignObligationDecl | DesignObligationDeclaration |
| DesignObligationDeclParam | DesignObligationDeclarationParam |
| DesignObligationDecls | DesignObligationDeclarations |
| DesignObligationId | DesignObligationIdentifier |
| DesignRecordId | DesignRecordIdentifier |
| DesignRecordRepositoryImpl | DesignRecordRepositoryImplementation |
| DesignReportId | DesignReportIdentifier |
| DesignScenarioDecl | DesignScenarioDeclaration |
| DesignScenarioDeclParam | DesignScenarioDeclarationParam |
| DesignScenarioDecls | DesignScenarioDeclarations |
| DesignScenarioId | DesignScenarioIdentifier |
| DesignTransitionDecl | DesignTransitionDeclaration |
| DesignTransitionDeclParam | DesignTransitionDeclarationParam |
| DesignTransitionDecls | DesignTransitionDeclarations |
| DesignTransitionId | DesignTransitionIdentifier |
| DesignUnitDecl | DesignUnitDeclaration |
| DesignUnitDeclParam | DesignUnitDeclarationParam |
| DesignUnitDecls | DesignUnitDeclarations |
| DesignUnitId | DesignUnitIdentifier |
| DesignVerifyDirectoryRepositoryImpl | DesignVerifyDirectoryRepositoryImplementation |
| DoctorWorkspaceClientConfig | DoctorWorkspaceClientConfiguration |
| DoctorWorkspaceClientImpl | DoctorWorkspaceClientImplementation |
| EntityDecl | EntityDeclaration |
| EntityDeclParam | EntityDeclarationParam |
| EntityDecls | EntityDeclarations |
| EnumMember | EnumerationMember |
| Err | ResultFailure |
| FormalModelId | FormalModelIdentifier |
| FormalModelRepositoryImpl | FormalModelRepositoryImplementation |
| FunctionalSpecOutcome | FunctionalSpecificationOutcome |
| GitHubReleaseTagsClientConfig | GitHubReleaseTagsClientConfiguration |
| GitHubReleaseTagsClientImpl | GitHubReleaseTagsClientImplementation |
| HarnessFileClientImpl | HarnessFileClientImplementation |
| InstallationProvenanceClientImpl | InstallationProvenanceClientImplementation |
| IrAttributeDecl | IntermediateRepresentationAttributeDeclaration |
| IrAttributeDeclParam | IntermediateRepresentationAttributeDeclarationParam |
| IrAttributeDecls | IntermediateRepresentationAttributeDeclarations |
| IrAttributeName | IntermediateRepresentationAttributeName |
| IrBackgroundDecl | IntermediateRepresentationBackgroundDeclaration |
| IrBackgroundDeclParam | IntermediateRepresentationBackgroundDeclarationParam |
| IrBackgroundDecls | IntermediateRepresentationBackgroundDeclarations |
| IrEntityDecl | IntermediateRepresentationEntityDeclaration |
| IrEntityDeclParam | IntermediateRepresentationEntityDeclarationParam |
| IrEntityDecls | IntermediateRepresentationEntityDeclarations |
| IrEntityName | IntermediateRepresentationEntityName |
| IrModelDecl | IntermediateRepresentationModelDeclaration |
| IrModelDeclParam | IntermediateRepresentationModelDeclarationParam |
| IrObligationDecl | IntermediateRepresentationObligationDeclaration |
| IrObligationDeclParam | IntermediateRepresentationObligationDeclarationParam |
| IrObligationDecls | IntermediateRepresentationObligationDeclarations |
| IrScenarioDecl | IntermediateRepresentationScenarioDeclaration |
| IrScenarioDeclParam | IntermediateRepresentationScenarioDeclarationParam |
| IrScenarioDecls | IntermediateRepresentationScenarioDeclarations |
| IrTemporalDecl | IntermediateRepresentationTemporalDeclaration |
| IrTemporalDeclParam | IntermediateRepresentationTemporalDeclarationParam |
| IrValidationMaterials | IntermediateRepresentationValidationMaterials |
| IrValidationMaterialsConfig | IntermediateRepresentationValidationMaterialsConfiguration |
| IrValidationMaterialsId | IntermediateRepresentationValidationMaterialsIdentifier |
| IrValidationMaterialsParam | IntermediateRepresentationValidationMaterialsParam |
| IrValidationMaterialsRepository | IntermediateRepresentationValidationMaterialsRepository |
| IrValidationMaterialsRepositoryImpl | IntermediateRepresentationValidationMaterialsRepositoryImplementation |
| IrVersion | IntermediateRepresentationVersion |
| LoweredId | LoweredIdentifier |
| LoweredOriginRef | LoweredOriginReference |
| MachineSpec | MachineSpecification |
| MdTable | MarkdownTable |
| ObligationId | ObligationIdentifier |
| ObligationIds | ObligationIdentifiers |
| Ok | ResultSuccess |
| QuintClientConfig | QuintClientConfiguration |
| QuintClientImpl | QuintClientImplementation |
| RawReqAttribute | RawRequirementAttribute |
| RawReqObligation | RawRequirementObligation |
| RawReqScenario | RawRequirementScenario |
| RefcheckBackendClient | ReferenceCheckBackendClient |
| RefcheckBackendClientConfig | ReferenceCheckBackendClientConfiguration |
| RefcheckBackendClientImpl | ReferenceCheckBackendClientImplementation |
| ReferenceCheckReportId | ReferenceCheckReportIdentifier |
| ReferenceCheckReportRepositoryImpl | ReferenceCheckReportRepositoryImplementation |
| RefinementAttr | RefinementAttributeParam |
| RefinementMapId | RefinementMapIdentifier |
| RefinementMapRepositoryImpl | RefinementMapRepositoryImplementation |
| RefinementMaterialsId | RefinementMaterialsIdentifier |
| RefinementMaterialsRepositoryImpl | RefinementMaterialsRepositoryImplementation |
| RefinementSmtContext | RefinementSatisfiabilityModuloTheoriesContext |
| RefinementSolverClientConfig | RefinementSolverClientConfiguration |
| RefinementSolverClientImpl | RefinementSolverClientImplementation |
| RelDecl | RelationshipDeclaration |
| RelDeclParam | RelationshipDeclarationParam |
| RelDecls | RelationshipDeclarations |
| RequirementId | RequirementIdentifier |
| RequirementIds | RequirementIdentifiers |
| RequirementsSourceId | RequirementsSourceIdentifier |
| RequirementsSourceRepositoryImpl | RequirementsSourceRepositoryImplementation |
| RuleDecl | RuleDeclaration |
| RuleDeclParam | RuleDeclarationParam |
| RuleDecls | RuleDeclarations |
| ScenarioId | ScenarioIdentifier |
| SiblingBackendClientConfig | SiblingBackendClientConfiguration |
| SiblingBackendClientImpl | SiblingBackendClientImplementation |
| SmtCheck | SatisfiabilityModuloTheoriesCheck |
| SmtChildQuery | SatisfiabilityModuloTheoriesChildQuery |
| SmtChildResult | SatisfiabilityModuloTheoriesChildResult |
| SmtCompileError | SatisfiabilityModuloTheoriesCompileError |
| SmtEventPairProbe | SatisfiabilityModuloTheoriesEventPairProbe |
| SmtEventPairProbeParam | SatisfiabilityModuloTheoriesEventPairProbeParam |
| SmtEventPairProbes | SatisfiabilityModuloTheoriesEventPairProbes |
| SmtPlan | SatisfiabilityModuloTheoriesPlan |
| SmtQueryStatus | SatisfiabilityModuloTheoriesQueryStatus |
| SmtQueryVerdict | SatisfiabilityModuloTheoriesQueryVerdict |
| SmtQueryVerdictParam | SatisfiabilityModuloTheoriesQueryVerdictParam |
| SmtQueryVerdicts | SatisfiabilityModuloTheoriesQueryVerdicts |
| SmtSolverResult | SatisfiabilityModuloTheoriesSolverResult |
| SmtVerificationPlan | SatisfiabilityModuloTheoriesVerificationPlan |
| SmtVerificationPlanParam | SatisfiabilityModuloTheoriesVerificationPlanParam |
| SolverProbeClientConfig | SolverProbeClientConfiguration |
| SolverProbeClientImpl | SolverProbeClientImplementation |
| SourceId | SourceIdentifier |
| SourceIds | SourceIdentifiers |
| SpecBlockAssessment | SpecificationBlockAssessment |
| SpecBlockAssessments | SpecificationBlockAssessments |
| TargetId | TargetIdentifier |
| TargetIds | TargetIdentifiers |
| TransitionRef | TransitionReference |
| TransitionRefs | TransitionReferences |
| UnitDecl | UnitDeclaration |
| UnitDeclParam | UnitDeclarationParam |
| UnitDecls | UnitDeclarations |
| UnmappedTargetRef | UnmappedTargetReference |
| ValidateDesignIrOutcome | ValidateDesignIntermediateRepresentationOutcome |
| ValidateDesignIrUseCase | ValidateDesignIntermediateRepresentationUseCase |
| ValidateIrOutcome | ValidateIntermediateRepresentationOutcome |
| ValidateIrUseCase | ValidateIntermediateRepresentationUseCase |
| VerificationDirectoryRepositoryImpl | VerificationDirectoryRepositoryImplementation |
| VerificationReportId | VerificationReportIdentifier |
| VerifyDesignSmtUseCase | VerifyDesignSatisfiabilityModuloTheoriesUseCase |
| VerifyRequirementsSmtInput | VerifyRequirementsSatisfiabilityModuloTheoriesInput |
| VerifyRequirementsSmtUseCase | VerifyRequirementsSatisfiabilityModuloTheoriesUseCase |
| VerifySmtOutcome | VerifySatisfiabilityModuloTheoriesOutcome |
| WitnessRef | WitnessReference |
| WitnessRefParam | WitnessReferenceParam |
| WitnessRefs | WitnessReferences |
| Z3SolverClient | Z3SolverClient |
| Z3SolverClientConfig | Z3SolverClientConfiguration |
| Z3SolverClientImpl | Z3SolverClientImplementation |
