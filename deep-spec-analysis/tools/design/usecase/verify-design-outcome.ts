// design-verify ユースケースの結果 — entry はこの閉じたユニオンで verdict 行と
// exit code を描く。version-mismatch の skippedCount は conform 前（組成時）の
// 件数（PR5 レビューで凍結を実証済み）。backend-unavailable は exit 127。

import type { RepositoryError } from "../../kernel/usecase/index.ts";

export type VerifyDesignOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: RepositoryError }
  | { readonly kind: "model-unreadable" }
  | { readonly kind: "version-mismatch"; readonly skippedCount: number }
  | { readonly kind: "backend-unavailable" }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | {
      readonly kind: "verified";
      readonly pass: boolean;
      readonly findingsCount: number;
      readonly skippedCount: number;
      readonly method: string;
    };
