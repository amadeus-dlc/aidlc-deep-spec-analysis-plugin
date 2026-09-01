// doctor/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { type CheckSeverity } from "./check-severity.ts";
export { type Check } from "./check.ts";
export { HealthVerdict } from "./health-verdict.ts";
export { type ManifestEntry } from "./manifest-entry.ts";
export { InstallationManifest } from "./installation-manifest.ts";
export { type InstalledStatus } from "./installed-status.ts";
export { type SolverAvailability } from "./solver-availability.ts";
export { type DigestAnchor } from "./digest-anchor.ts";
export { VerificationStaleness } from "./verification-staleness.ts";
export { type CoverageState } from "./coverage-state.ts";
export { type CoverageRow } from "./coverage-row.ts";
export { CoverageAssessment } from "./coverage-assessment.ts";
export { type DebtRow } from "./debt-row.ts";
export { StructuralDebt } from "./structural-debt.ts";
export { type UnitCoverageRow } from "./unit-coverage-row.ts";
export { type RefinementStaleRow } from "./refinement-stale-row.ts";
export { UnitCoverage } from "./unit-coverage.ts";
