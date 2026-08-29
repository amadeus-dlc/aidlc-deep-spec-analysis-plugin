// Repository 共有のエラー語彙 — ポートごとに固有エラー型を乱造しない。
// 予期される失敗は 3 種に閉じる：不在（findById が見つけられない）・
// I/O の失敗（読み書き）・読めたが集約として再構成できない破損。
// 変種は材料のみを運び、文言は emitter 側の責務。

export type RepositoryError =
  | { readonly kind: "not-found"; readonly path: string }
  | { readonly kind: "io-failed"; readonly operation: "read" | "write"; readonly path: string; readonly cause: string }
  | { readonly kind: "corrupt"; readonly path: string; readonly cause: string };
