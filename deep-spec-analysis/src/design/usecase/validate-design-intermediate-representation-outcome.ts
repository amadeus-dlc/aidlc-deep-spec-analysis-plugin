import type { ValidationAssessment } from "@deep-spec/kernel-domain";
import type { RepositoryError } from "@deep-spec/kernel-usecase";

export type ValidateDesignIntermediateRepresentationOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: Exclude<RepositoryError, { readonly kind: "not-found" }> }
  | { readonly kind: "verdict"; readonly assessment: ValidationAssessment };
