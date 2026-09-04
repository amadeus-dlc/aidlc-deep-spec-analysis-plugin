import type { RefinementQueryVerdicts } from "@deep-spec/design-domain";

export type RefinementSolverResult =
  | { readonly kind: "no-queries" }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: RefinementQueryVerdicts };
