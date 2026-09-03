import type { RefinementSolverPlan } from "@deep-spec/refinement-domain";
import type { RefinementSolverResult } from "./refinement-solver-result.ts";

export interface RefinementCheck {
  readonly plan: RefinementSolverPlan;
  readonly result: RefinementSolverResult;
}
