// doctor/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { Check } from "./check.ts";
export { CheckSeverity } from "./check-severity.ts";
export { CoverageState } from "./coverage-state.ts";
export { DigestAnchor } from "./digest-anchor.ts";
export { HealthVerdict } from "./health-verdict.ts";
export { InstallationManifest } from "./installation-manifest.ts";
export { InstalledStatus } from "./installed-status.ts";
export { ManifestEntry } from "./manifest-entry.ts";
export { PluginVersion } from "./plugin-version.ts";
export { SolverAvailability } from "./solver-availability.ts";
export { VerificationStaleness } from "./verification-staleness.ts";
