// verify-smt ユースケースの結果 — entry はこの閉じたユニオンで verdict 行と
// exit code を描く。文書はどの経路でも（not-applicable を除き）書かれた後。

import type { RepositoryError } from "../../kernel/usecase/index.ts";

export type VerifySmtOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: RepositoryError }
  | { readonly kind: "model-unreadable" }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "solver-unavailable" }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | {
      readonly kind: "verified";
      readonly pass: boolean;
      readonly findingsCount: number;
      readonly skippedCount: number;
    };
