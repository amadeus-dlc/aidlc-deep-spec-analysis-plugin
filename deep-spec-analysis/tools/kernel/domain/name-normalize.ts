// 成果物横断のエンティティ名正規化（XS 検査）。逐語移動。

// Name normalization for cross-artifact entity matching (XS checks):
// casefold + strip non-alphanumerics, so "OrderItem" matches "order_item".
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
