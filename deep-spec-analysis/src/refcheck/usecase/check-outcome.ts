// refcheck ユースケースの結果型 — 合成ルートが verdict 行と exit code に写す。

import type { RepositoryError } from "@deep-spec/kernel-usecase";

export type CheckOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "save-failed"; readonly error: RepositoryError }
  | { readonly kind: "verified"; readonly pass: boolean; readonly findingsCount: number; readonly skippedCount: number };
