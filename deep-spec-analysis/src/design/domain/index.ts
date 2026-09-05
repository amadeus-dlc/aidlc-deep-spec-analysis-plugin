// design/domain の公開 facade — 明示列挙のみ（export * 禁止）。

// RefinementRequirements の恒等 — 契約1 集約の識別子そのもの（プロファイルは
// 恒等を変えない）。所有は requirements/domain。design はこの facade 経由で
// そのまま再輸出する。
// refinement の要件語彙は requirements の DP を再利用する。
export {
  AttributeBound,
  AttributePath,
  FormalModelIdentifier,
  ObligationIdentifier,
  ObligationNature,
  ScenarioIdentifier,
} from "@deep-spec/requirements-domain";
export { AttributeMapping } from "./attribute-mapping.ts";
export { AttributeMappings } from "./attribute-mappings.ts";
export { AttributePaths } from "./attribute-paths.ts";
export { BusinessRuleReference } from "./business-rule-reference.ts";
export { BusinessRuleReferenceIndex } from "./business-rule-reference-index.ts";
export { BusinessRuleReferences } from "./business-rule-references.ts";
export { CheckedUnits } from "./checked-units.ts";
export { DesignAssignments } from "./design-assignments.ts";
export { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
export { DesignAttributeDeclarations } from "./design-attribute-declarations.ts";
export { DesignAttributeName } from "./design-attribute-name.ts";
export { DesignBackgroundAssumption } from "./design-background-assumption.ts";
export { DesignBackgroundAssumptions } from "./design-background-assumptions.ts";
export { DesignBackgroundDeclaration } from "./design-background-declaration.ts";
export { DesignBackgroundDeclarations } from "./design-background-declarations.ts";
export { DesignBackgroundIdentifier } from "./design-background-identifier.ts";
export { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
export { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";
export { DesignEntityDeclaration } from "./design-entity-declaration.ts";
export { DesignEntityDeclarations } from "./design-entity-declarations.ts";
export { DesignEntityName } from "./design-entity-name.ts";
export { DesignEvent } from "./design-event.ts";
export { DesignEventCatalog } from "./design-event-catalog.ts";
export { DesignFinding } from "./design-finding.ts";
export { DesignFindings } from "./design-findings.ts";
export { DesignIgnore } from "./design-ignore.ts";
export { DesignIgnoreDeclaration } from "./design-ignore-declaration.ts";
export { DesignIgnoreDeclarations } from "./design-ignore-declarations.ts";
export { DesignIgnores } from "./design-ignores.ts";
export { DesignInputAnchor } from "./design-input-anchor.ts";
export { DesignInputAnchors } from "./design-input-anchors.ts";
export { DesignIntermediateRepresentationValidationMaterials } from "./design-intermediate-representation-validation-materials.ts";
export { DesignIntermediateRepresentationValidationMaterialsIdentifier } from "./design-intermediate-representation-validation-materials-identifier.ts";
export { DesignMachine } from "./design-machine.ts";
export { DesignMachineDeclaration } from "./design-machine-declaration.ts";
export { DesignMachineDeclarations } from "./design-machine-declarations.ts";
export { DesignMachineIdentifier } from "./design-machine-identifier.ts";
export { DesignMachines } from "./design-machines.ts";
export { DesignModel } from "./design-model.ts";
export { DesignModelIdentifier } from "./design-model-identifier.ts";
export { DesignObligation } from "./design-obligation.ts";
export { DesignObligationDeclaration } from "./design-obligation-declaration.ts";
export { DesignObligationDeclarations } from "./design-obligation-declarations.ts";
export { DesignObligationIdentifier } from "./design-obligation-identifier.ts";
export { DesignObligationNature } from "./design-obligation-nature.ts";
export { DesignObligationOrigin } from "./design-obligation-origin.ts";
export { DesignObligations } from "./design-obligations.ts";
export { DesignReport, SUPPORTED_DESIGN_IR_MAJOR } from "./design-report.ts";
export { DesignReportIdentifier } from "./design-report-identifier.ts";
export { DesignReports } from "./design-reports.ts";
export { DesignScenario } from "./design-scenario.ts";
export { DesignScenarioDeclaration } from "./design-scenario-declaration.ts";
export { DesignScenarioDeclarations } from "./design-scenario-declarations.ts";
export { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";
export { DesignScenarios } from "./design-scenarios.ts";
export { DesignSkipped } from "./design-skipped.ts";
export { DesignSkips } from "./design-skips.ts";
export { DesignTransition } from "./design-transition.ts";
export { DesignTransitionDeclaration } from "./design-transition-declaration.ts";
export { DesignTransitionDeclarations } from "./design-transition-declarations.ts";
export { DesignTransitionIdentifier } from "./design-transition-identifier.ts";
export { DesignTransitions } from "./design-transitions.ts";
export { DesignUnit } from "./design-unit.ts";
export { DesignUnitDeclaration } from "./design-unit-declaration.ts";
export { DesignUnitDeclarations } from "./design-unit-declarations.ts";
export { DesignUnitIdentifier } from "./design-unit-identifier.ts";
export { DesignUnits } from "./design-units.ts";
export { DesignVerifyDirectory } from "./design-verify-directory.ts";
export { DesignWitness } from "./design-witness.ts";
export { EffectAssignments } from "./effect-assignments.ts";
export { EventMapping } from "./event-mapping.ts";
export { EventMappings } from "./event-mappings.ts";
export { InitialState } from "./initial-state.ts";
export { InitialStates } from "./initial-states.ts";
export { LoweredBackground } from "./lowered-background.ts";
export { LoweredBackgrounds } from "./lowered-backgrounds.ts";
export { LoweredIdentifier } from "./lowered-identifier.ts";
export { LoweredObligation } from "./lowered-obligation.ts";
export { LoweredObligations } from "./lowered-obligations.ts";
export { LoweredOrigin } from "./lowered-origin.ts";
export { LoweredOriginReference } from "./lowered-origin-reference.ts";
export { LoweredScenario } from "./lowered-scenario.ts";
export { LoweredScenarios } from "./lowered-scenarios.ts";
export { LoweredUnit } from "./lowered-unit.ts";
export { LoweringIndex } from "./lowering-index.ts";
export { ReachabilityVerdict } from "./reachability-verdict.ts";
export { RefinementAttribute } from "./refinement-attribute.ts";
export { RefinementAttributes } from "./refinement-attributes.ts";
export { RefinementMap } from "./refinement-map.ts";
export { RefinementMapAcquisition } from "./refinement-map-acquisition.ts";
export { RefinementMapDefect } from "./refinement-map-defect.ts";
export { RefinementMapIdentifier } from "./refinement-map-identifier.ts";
export { RefinementMaterials } from "./refinement-materials.ts";
export { RefinementMaterialsIdentifier } from "./refinement-materials-identifier.ts";
export { RefinementObligation } from "./refinement-obligation.ts";
export { RefinementObligations } from "./refinement-obligations.ts";
export { RefinementProbe } from "./refinement-probe.ts";
export { RefinementQueryVerdict } from "./refinement-query-verdict.ts";
export { RefinementQueryVerdicts } from "./refinement-query-verdicts.ts";
export { RefinementQuintInvariant } from "./refinement-quint-invariant.ts";
export { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";
// refinement（旧 src/refinement/domain/）から統合された公開 symbol。
// このコンテキストは adapter を持たない：design のユースケースが消費する
// ドメインサービス群で、I/O・SMT-LIB という形式は design の ports / adapters が担う。
export { RefinementRequirements } from "./refinement-requirements.ts";
export { RefinementScenario } from "./refinement-scenario.ts";
export { RefinementScenarios } from "./refinement-scenarios.ts";
export { RefinementSolverPlan } from "./refinement-solver-plan.ts";
export { RefinementStatus } from "./refinement-status.ts";
export { RefinementUnitMap } from "./refinement-unit-map.ts";
export { RefinementUnitMaps } from "./refinement-unit-maps.ts";
export { SiblingVerdictDocument } from "./sibling-verdict-document.ts";
export { SiblingVerdictFinding } from "./sibling-verdict-finding.ts";
export { SiblingVerdictFindings } from "./sibling-verdict-findings.ts";
export { SiblingVerdictSkip } from "./sibling-verdict-skip.ts";
export { SiblingVerdictSkips } from "./sibling-verdict-skips.ts";
export { TransitionReference } from "./transition-reference.ts";
export { TransitionReferences } from "./transition-references.ts";
export { UnformalizedTargets } from "./unformalized-targets.ts";
export { UnitRefinementPlan } from "./unit-refinement-plan.ts";
export { UnmappedDeclarations } from "./unmapped-declarations.ts";
export { UnmappedTarget } from "./unmapped-target.ts";
export { UnmappedTargetReference } from "./unmapped-target-reference.ts";
