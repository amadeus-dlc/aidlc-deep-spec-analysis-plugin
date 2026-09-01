import type { SmtQueryVerdicts } from "../../domain/index.ts";

export type SmtSolverResult =
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: SmtQueryVerdicts };
