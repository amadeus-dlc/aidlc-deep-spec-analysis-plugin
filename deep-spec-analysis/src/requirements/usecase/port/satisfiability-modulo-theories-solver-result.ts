import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "@deep-spec/requirements-domain";

export type SatisfiabilityModuloTheoriesSolverResult =
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: SatisfiabilityModuloTheoriesQueryVerdicts };
