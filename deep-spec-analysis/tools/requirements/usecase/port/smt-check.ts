import type { SmtVerificationPlan } from "../../domain/index.ts";
import type { SmtSolverResult } from "./smt-solver-result.ts";

export interface SmtCheck {
  readonly plan: SmtVerificationPlan;
  readonly result: SmtSolverResult;
}
