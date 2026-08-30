// requirements/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { type AttributeDeclaration } from "./attribute-declaration.ts";
export { type Obligation } from "./obligation.ts";
export { type Scenario } from "./scenario.ts";
export {
  type BackgroundAssumption,
  type RequirementsModelSeed,
  RequirementsModel,
} from "./requirements-model.ts";
export {
  type VerificationFinding,
  type VerificationSkipped,
  type VerificationWitness,
} from "./verification-finding.ts";
export { sortVerificationFindings, sortVerificationSkipped } from "./verification-finding-order.ts";
export { VerificationReportId } from "./verification-report-id.ts";
export {
  type CrossCheckedEntry,
  type VerificationReportComposition,
  type VerificationReportSeed,
  VerificationReport,
} from "./verification-report.ts";
export { type SmtQueryStatus, type SmtQueryVerdict } from "./solver-verdict.ts";
export { type SmtEventPairProbe, type SmtPlanFacts } from "./smt-plan-facts.ts";
export { SUPPORTED_IR_MAJOR, irUnreadableReport, versionMismatchReport } from "./verification-degradation.ts";
export { solverUnavailableReport } from "./smt-degradation.ts";
export { machineUncompilableReport, quintUnavailableReport } from "./quint-degradation.ts";
export { type InterpretedVerdicts, interpretSmtVerdicts } from "./smt-verdict-interpretation.ts";
export { crossCheckReport } from "./cross-check.ts";
export { type DecodedValue, type TraceState } from "./trace-state.ts";
export { evaluateExpression } from "./expression-evaluation.ts";
export { type QuintMachineComponent, type QuintMachineFacts } from "./quint-machine-facts.ts";
export {
  type QuintMachineRunVerdict,
  type QuintRuns,
  type QuintScenarioVerdict,
  type QuintTemporalVerdict,
} from "./quint-verdict.ts";
export { type InterpretedQuintVerdicts, interpretQuintVerdicts } from "./quint-verdict-interpretation.ts";
export {
  type IrAttributeView,
  type IrBackgroundView,
  type IrEntityView,
  type IrModelView,
  type IrObligationView,
  type IrScenarioView,
  type IrTemporalView,
} from "./ir-model-view.ts";
export { modelWellFormednessErrors } from "./model-well-formedness.ts";
export { type FrRefClaim, FrReferenceIndex } from "./fr-reference-index.ts";
export { SourceAnchor } from "./source-anchor.ts";
export { RequirementsSourceId } from "./requirements-source-id.ts";
