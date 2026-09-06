// refcheck ユースケースの結果型 — 合成ルートが verdict 行と exit code に写す。

import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { ReferenceCheckReport } from "@deep-spec-analysis/refcheck-domain";

export type CheckOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "acquisition-failed"; readonly error: RepositoryError }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | {
      readonly kind: "verified";
      readonly report: ReferenceCheckReport;
    };
