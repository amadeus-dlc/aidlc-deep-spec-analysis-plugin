import type { SmtPlanFacts } from "../domain/index.ts";
import type { SmtSolverResult } from "./smt-solver-result.ts";

export interface SmtCheck {
  readonly facts: SmtPlanFacts;
  readonly result: SmtSolverResult;
}
