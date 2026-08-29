// requirements/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { type AttributeDeclaration } from "./attribute-declaration.ts";
export { type Expression, expressionUsesPrime } from "./expression.ts";
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
export {
  SUPPORTED_IR_MAJOR,
  irUnreadableReport,
  solverUnavailableReport,
  versionMismatchReport,
} from "./smt-degradation.ts";
export { type InterpretedVerdicts, interpretSmtVerdicts } from "./smt-verdict-interpretation.ts";
export { crossCheckReport } from "./cross-check.ts";
