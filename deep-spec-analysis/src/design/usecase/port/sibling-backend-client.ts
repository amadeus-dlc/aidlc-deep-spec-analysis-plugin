import type {
  DesignUnit,
  LoweredUnit,
  ReachabilityProbe,
  ReachabilityVerdict,
  SiblingVerificationResult,
  UnitRefinementPlan,
} from "@deep-spec/design-domain";

export interface SiblingBackendClient {
  runLowered(
    backend: "smt" | "quint",
    unit: DesignUnit,
    lowered: LoweredUnit,
    wallTimeoutMs: number,
  ): SiblingVerificationResult;
  runRefinement(plan: UnitRefinementPlan, wallTimeoutMs: number): SiblingVerificationResult;
  probeState(probe: ReachabilityProbe, wallTimeoutMs: number): ReachabilityVerdict;
}
