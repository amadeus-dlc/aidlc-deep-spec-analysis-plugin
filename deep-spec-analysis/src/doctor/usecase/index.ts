// doctor/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export { CheckFunctionalCoverageUseCase } from "./check-functional-coverage-usecase.ts";
export { CheckInstallationUseCase } from "./check-installation-usecase.ts";
export { CheckSolversUseCase } from "./check-solvers-usecase.ts";
export { CheckStructuralDebtUseCase } from "./check-structural-debt-usecase.ts";
export { CheckVerificationCoverageUseCase } from "./check-verification-coverage-usecase.ts";
export { CheckVersionAdvisoryUseCase } from "./check-version-advisory-usecase.ts";
export type { DesignArtifactReference } from "./port/design-artifact-reference.ts";
export type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
export type { FunctionalTarget } from "./port/functional-target.ts";
export type { FunctionalUnitScan } from "./port/functional-unit-scan.ts";
export type { HarnessFileClient } from "./port/harness-file-client.ts";
export type { InstallationProvenanceClient } from "./port/installation-provenance-client.ts";
export type { InstallationProvenanceRead } from "./port/installation-provenance-read.ts";
export type { ReferenceCheckBackendClient } from "./port/reference-check-backend-client.ts";
export type { ReleaseTagsClient } from "./port/release-tags-client.ts";
export type { ReleaseTagsRead } from "./port/release-tags-read.ts";
export type { SolverProbeClient } from "./port/solver-probe-client.ts";
export type { VerificationTarget } from "./port/verification-target.ts";
export { CoverageAssessment } from "./read-model/coverage-assessment.ts";
// リードモデル（裁定 22）——クエリ側の投影。presenter が読む。
export { CoverageRow } from "./read-model/coverage-row.ts";
export { DebtRow } from "./read-model/debt-row.ts";
export { RefinementStaleRow } from "./read-model/refinement-stale-row.ts";
export { StructuralDebt } from "./read-model/structural-debt.ts";
export { UnitCoverage } from "./read-model/unit-coverage.ts";
export { UnitCoverageRow } from "./read-model/unit-coverage-row.ts";
export { VersionAdvisory } from "./read-model/version-advisory.ts";
