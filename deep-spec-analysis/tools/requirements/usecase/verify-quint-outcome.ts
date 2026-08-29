// verify-quint ユースケースの結果 — entry はこの閉じたユニオンで verdict 行と
// exit code を描く。machine-uncompilable は exit 0（note）、backend-unavailable
// は exit 127（旧挙動の凍結）。verified の method は検出値（bounded /
// simulation）で verdict 行に逐語で載る。

import type { RepositoryError } from "../../kernel/usecase/index.ts";

export type VerifyQuintOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: RepositoryError }
  | { readonly kind: "model-unreadable" }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "backend-unavailable" }
  | { readonly kind: "machine-uncompilable" }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | {
      readonly kind: "verified";
      readonly pass: boolean;
      readonly findingsCount: number;
      readonly skippedCount: number;
      readonly method: string;
    };
