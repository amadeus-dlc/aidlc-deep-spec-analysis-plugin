import type { RefinementCheck, UnitRefinementPlan } from "@deep-spec/design-domain";

export interface RefinementSolverClient {
  check(plan: UnitRefinementPlan, budgetMs: number): RefinementCheck;
}
