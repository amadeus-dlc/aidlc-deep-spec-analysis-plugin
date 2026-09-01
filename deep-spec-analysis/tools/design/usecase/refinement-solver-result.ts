import type { RefinementQueryVerdicts } from "../../refinement/domain/index.ts";

export type RefinementSolverResult =
  | { readonly kind: "no-queries" }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: RefinementQueryVerdicts };
