import type { RefinementSolverPlan } from "../../../refinement/domain/index.ts";
import type { RefinementSolverResult } from "./refinement-solver-result.ts";

export interface RefinementCheck {
  readonly plan: RefinementSolverPlan;
  readonly result: RefinementSolverResult;
}
