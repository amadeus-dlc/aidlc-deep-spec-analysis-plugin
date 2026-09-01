import type { RefinementSolverFacts } from "../../../refinement/domain/index.ts";
import type { RefinementSolverResult } from "./refinement-solver-result.ts";

export interface RefinementCheck {
  readonly facts: RefinementSolverFacts;
  readonly result: RefinementSolverResult;
}
