// ir-valid ユースケースの結果 — entry はこの閉じたユニオンで verdict 行を描く。
// verdictは型付きの検査結果を保持する。取得失敗の診断表示と件数の切り詰めはentryが行う。

import type { ValidationAssessment } from "@deep-spec/kernel-domain";
import type { RepositoryError } from "@deep-spec/kernel-usecase";

export type ValidateIntermediateRepresentationOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: Exclude<RepositoryError, { kind: "not-found" }> }
  | { readonly kind: "verdict"; readonly assessment: ValidationAssessment };
