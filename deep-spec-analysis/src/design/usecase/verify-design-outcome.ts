import type { DesignReport, DesignVerifyDirectory } from "@deep-spec/design-domain";
import type { RepositoryError } from "@deep-spec/kernel-usecase";

export type VerifyDesignOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: RepositoryError }
  | { readonly kind: "model-unreadable" }
  | { readonly kind: "version-mismatch"; readonly report: DesignReport }
  | { readonly kind: "backend-unavailable" }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | { readonly kind: "verified"; readonly directory: DesignVerifyDirectory };
