import type { SmtVerificationPlan } from "@deep-spec/requirements-domain";
import type { SmtSolverResult } from "./smt-solver-result.ts";

export interface SmtCheck {
  readonly plan: SmtVerificationPlan;
  readonly result: SmtSolverResult;
}
