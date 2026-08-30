// design/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { type DesignValue } from "./design-value.ts";
export { type DesignTransition } from "./design-transition.ts";
export { type DesignMachine, DesignMachines } from "./design-machine.ts";
export { type DesignObligation, DesignObligations } from "./design-obligation.ts";
export { type DesignScenario, DesignScenarios } from "./design-scenario.ts";
export {
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
export { sortDesignFindings, sortDesignSkipped } from "./design-finding-order.ts";
export { expressionCanonicalKey } from "./expression-canonical-key.ts";
export {
  type LoweredOrigin,
  type LoweringKind,
  type LoweredBackground,
  type LoweredObligation,
  type LoweredScenario,
  type LoweredUnit,
  lowerUnit,
} from "./lower-unit.ts";
export {
  type RemappedUnit,
  type SiblingVerdictDocument,
  type SiblingVerdictFinding,
  type SiblingVerdictSkip,
  remapUnitDocument,
} from "./remap-unit-doc.ts";
export { DesignReportId } from "./design-report-id.ts";
export {
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
export { designCrossCheckReport } from "./design-cross-check.ts";
export {
  SUPPORTED_DESIGN_IR_MAJOR,
  designBackendUnavailableReport,
  designIrUnreadableReport,
  designVersionMismatchReport,
} from "./design-degradation.ts";
export {
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
