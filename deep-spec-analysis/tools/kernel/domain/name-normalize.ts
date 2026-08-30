// 成果物横断のエンティティ名正規化（XS 検査）。逐語移動。旧自由関数
// normalizeName は Names の随伴クラスに従属した（OOUI 裁定）。

export class Names {
  private constructor() {}

  // Name normalization for cross-artifact entity matching (XS checks):
  // casefold + strip non-alphanumerics, so "OrderItem" matches "order_item".
  static normalize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
}
