// design-ir-valid ユースケースの結果 — entry はこの閉じたユニオンで verdict 行を
// 描く。not-applicable は pass:true の pass-through 行。

export type ValidateDesignIntermediateRepresentationOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "verdict"; readonly pass: boolean; readonly errors: readonly string[] };
