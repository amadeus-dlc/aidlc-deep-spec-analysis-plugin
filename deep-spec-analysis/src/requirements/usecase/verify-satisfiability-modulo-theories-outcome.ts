// verify-smt ユースケースの結果 — entry はこの閉じたユニオンで verdict 行と
// exit code を描く。verified は保存済み集約を運ぶ。取得・保存失敗を成功として返さない。

import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { VerificationDirectory } from "@deep-spec/requirements-domain";

export type VerifySatisfiabilityModuloTheoriesOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: RepositoryError }
  | { readonly kind: "model-unreadable" }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "solver-unavailable" }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | {
      readonly kind: "verified";
      readonly directory: VerificationDirectory;
    };
