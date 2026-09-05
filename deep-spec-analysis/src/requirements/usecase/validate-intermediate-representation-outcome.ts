// ir-valid ユースケースの結果 — entry はこの閉じたユニオンで verdict 行を描く。
// not-applicable は pass:true の pass-through 行、verdict は errors[] を
// MAX_REPORTED_ERRORS で切って載せる（切り詰めは描画側の責務）。

export type ValidateIntermediateRepresentationOutcome =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "verdict"; readonly pass: boolean; readonly errors: readonly string[] };
