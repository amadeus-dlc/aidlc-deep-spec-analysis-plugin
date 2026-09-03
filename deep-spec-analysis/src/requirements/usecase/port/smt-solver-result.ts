import type { SmtQueryVerdicts } from "@deep-spec/requirements-domain";

export type SmtSolverResult =
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: SmtQueryVerdicts };
