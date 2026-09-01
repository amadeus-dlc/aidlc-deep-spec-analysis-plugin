// doctor/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export { type HarnessFileClient } from "./port/harness-file-client.ts";
export { type SolverProbeClient } from "./port/solver-probe-client.ts";
export { type RefcheckBackendClient } from "./port/refcheck-backend-client.ts";
export { type VerificationTarget } from "./port/verification-target.ts";
export { type DesignArtifactRef } from "./port/design-artifact-ref.ts";
export { type FunctionalUnitFacts } from "./port/functional-unit-facts.ts";
export { type FunctionalTarget } from "./port/functional-target.ts";
export { type DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
export { CheckInstallationUseCase } from "./check-installation-usecase.ts";
export { CheckSolversUseCase } from "./check-solvers-usecase.ts";
export { CheckVerificationCoverageUseCase } from "./check-verification-coverage-usecase.ts";
export { CheckStructuralDebtUseCase } from "./check-structural-debt-usecase.ts";
export { CheckFunctionalCoverageUseCase } from "./check-functional-coverage-usecase.ts";
