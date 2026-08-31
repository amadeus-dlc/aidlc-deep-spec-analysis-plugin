// design/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { type DesignValue } from "./design-value.ts";
export { type DesignTransition, type DesignTransitionIdError, DesignTransitionId, DesignTransitions } from "./design-transition.ts";
export {
  type DesignIgnore,
  type DesignMachine,
  type DesignMachineTokenError,
  DesignAttributeName,
  DesignEntityName,
  DesignIgnores,
  DesignMachineId,
  DesignMachines,
} from "./design-machine.ts";
export {
  type DesignObligation,
  type DesignObligationIdError,
  DesignObligationId,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignObligations,
} from "./design-obligation.ts";
export { type DesignScenario, type DesignScenarioIdError, DesignScenarioId, DesignScenarios } from "./design-scenario.ts";
export {
  type DesignBackgroundIdError,
  DesignBackgroundId,
  type DesignBackgroundAssumption,
  type DesignUnitSeed,
  AttrPaths,
  DesignBackgroundAssumptions,
  DesignUnit,
  DesignUnits,
} from "./design-unit.ts";
export { type DesignModelComposition, DesignModel } from "./design-model.ts";
export {
  DesignFindings,
  DesignSkips, type DesignFinding, type DesignSkipped } from "./design-finding.ts";
export { ExpressionCanonicalKey } from "./expression-canonical-key.ts";
export {
  type LoweredOrigin,
  type LoweringKind,
  type LoweredBackground,
  type LoweredObligation,
  type LoweredScenario,
  LoweredBackgrounds,
  LoweredObligations,
  LoweredScenarios,
  LoweredUnit,
  LoweringIndex,
} from "./lower-unit.ts";
export {
  type RemappedUnit,
  type SiblingVerdictDocument,
  type SiblingVerdictFinding,
  type SiblingVerdictSkip,
  SiblingVerdictFindings,
  SiblingVerdictSkips,
} from "./remap-unit-doc.ts";
export { DesignReportId } from "./design-report-id.ts";
export {
  SUPPORTED_DESIGN_IR_MAJOR,
  CheckedUnits,
  DesignCrossCheckedEntries,
  DesignInputAnchors,
  DesignReports,
  type DesignCrossCheckedEntry,
  type DesignInputAnchor,
  type DesignReportComposition,
  type DesignReportSeed,
  DesignReport,
} from "./design-report.ts";
export {
  BindingPairs,
  BrRefs,
  DeclaredValues,
  DesignAttributeDecls,
  DesignBackgroundDecls,
  DesignEntityDecls,
  DesignIgnoreDecls,
  DesignMachineDecls,
  DesignObligationDecls,
  DesignScenarioDecls,
  DesignTransitionDecls,
  DesignUnitDecls,
  InitialStates,
  UnformalizedTargets,
  type DesignAttributeDecl,
  type DesignBackgroundDecl,
  type DesignEntityDecl,
  type DesignIgnoreDecl,
  type DesignMachineDecl,
  type DesignObligationDecl,
  type DesignScenarioDecl,
  type DesignTemporalDecl,
  type DesignTransitionDecl,
  type DesignUnitDecl,
} from "./design-ir-decl.ts";
export { BrReferenceIndex } from "./br-reference-index.ts";
export { designWellFormednessErrors } from "./design-well-formedness.ts";
export { DesignModelId } from "./design-model-id.ts";
export { DesignUnitId } from "./design-unit-id.ts";
export { RefinementMaterialsId } from "./refinement-materials-id.ts";
export {
  type DesignIrValidationMaterialsSeed,
  DesignIrValidationMaterials,
  DesignIrValidationMaterialsId,
} from "./design-ir-validation-materials.ts";
