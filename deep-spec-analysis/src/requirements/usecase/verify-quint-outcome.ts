// verify-quint ユースケースの結果 — entry はこの閉じたユニオンで verdict 行と
// exit code を描く。machine-uncompilable は exit 0（note）、backend-unavailable
// は exit 127（旧挙動の凍結）。verified は保存済み集約を運び、entryが公開文書から描画する。

import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { VerificationDirectory } from "@deep-spec/requirements-domain";

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
      readonly directory: VerificationDirectory;
    };
