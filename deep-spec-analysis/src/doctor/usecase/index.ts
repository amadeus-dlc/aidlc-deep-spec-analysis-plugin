// doctor/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export { CheckFunctionalCoverageUseCase } from "./check-functional-coverage-usecase.ts";
export { CheckInstallationUseCase } from "./check-installation-usecase.ts";
export { CheckSolversUseCase } from "./check-solvers-usecase.ts";
export { CheckStructuralDebtUseCase } from "./check-structural-debt-usecase.ts";
export { CheckVerificationCoverageUseCase } from "./check-verification-coverage-usecase.ts";
export { CheckVersionAdvisoryUseCase } from "./check-version-advisory-usecase.ts";
export type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
export type { HarnessFileClient } from "./port/harness-file-client.ts";
export type { InstallationProvenanceClient } from "./port/installation-provenance-client.ts";
export type { ReferenceCheckBackendClient } from "./port/reference-check-backend-client.ts";
export type { ReleaseTagsClient } from "./port/release-tags-client.ts";
export type { SolverProbeClient } from "./port/solver-probe-client.ts";
