// doctor/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { CheckSeverity } from "./check-severity.ts";
export { Check } from "./check.ts";
export { HealthVerdict } from "./health-verdict.ts";
export { ManifestEntry } from "./manifest-entry.ts";
export { InstallationManifest } from "./installation-manifest.ts";
export { InstalledStatus } from "./installed-status.ts";
export { SolverAvailability } from "./solver-availability.ts";
export { DigestAnchor } from "./digest-anchor.ts";
export { VerificationStaleness } from "./verification-staleness.ts";
export { CoverageState } from "./coverage-state.ts";
