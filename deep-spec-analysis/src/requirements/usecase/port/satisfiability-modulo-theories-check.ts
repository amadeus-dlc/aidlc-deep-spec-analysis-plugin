import type { SatisfiabilityModuloTheoriesVerificationPlan } from "@deep-spec/requirements-domain";
import type { SatisfiabilityModuloTheoriesSolverResult } from "./satisfiability-modulo-theories-solver-result.ts";

export interface SatisfiabilityModuloTheoriesCheck {
  readonly plan: SatisfiabilityModuloTheoriesVerificationPlan;
  readonly result: SatisfiabilityModuloTheoriesSolverResult;
}
