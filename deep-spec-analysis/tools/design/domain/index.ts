// design/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { type DesignValue } from "./design-value.ts";
export { type DesignTransition } from "./design-transition.ts";
export { type DesignMachine } from "./design-machine.ts";
export { type DesignObligation } from "./design-obligation.ts";
export { type DesignScenario } from "./design-scenario.ts";
export { type DesignBackgroundAssumption, type DesignUnitSeed, DesignUnit } from "./design-unit.ts";
export { type DesignModelComposition, DesignModel } from "./design-model.ts";
export { type DesignFinding, type DesignSkipped } from "./design-finding.ts";
export { sortDesignFindings, sortDesignSkipped } from "./design-finding-order.ts";
export { expressionCanonicalKey } from "./expression-canonical-key.ts";
export {
  type LowEntry,
  type LowKind,
  type LoweredBackground,
  type LoweredObligation,
  type LoweredScenario,
  type LoweredUnit,
  lowerUnit,
} from "./lower-unit.ts";
export {
  type RemappedUnit,
  type SiblingVerdictDoc,
  type SiblingVerdictFinding,
  type SiblingVerdictSkip,
  remapUnitDoc,
} from "./remap-unit-doc.ts";
export { DesignReportId } from "./design-report-id.ts";
export {
  type DesignCrossCheckedEntry,
  type DesignInputEntry,
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
  type DesignAttributeView,
  type DesignBackgroundView,
  type DesignEntityView,
  type DesignIgnoreView,
  type DesignMachineView,
  type DesignObligationView,
  type DesignScenarioView,
  type DesignTemporalView,
  type DesignTransitionView,
  type DesignUnitView,
} from "./design-ir-view.ts";
export { BrReferenceIndex } from "./br-reference-index.ts";
export { designWellFormednessErrors } from "./design-well-formedness.ts";
export { DesignModelId } from "./design-model-id.ts";
export { RefinementContextId } from "./refinement-context-id.ts";
