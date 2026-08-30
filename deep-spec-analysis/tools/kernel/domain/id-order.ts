// id の正準順序 — 英字骨格→数値セグメント比較。skipped ソートと checked[]
// の順序（= golden バイト）を決める比較器。deep-spec-lib.ts からの逐語移動。
// 旧自由関数 idCompare / sortedUnique は IdOrder の随伴クラスに従属した
// （OOUI 裁定）。

function numSegments(id: string): number[] {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}

export class IdOrder {
  // static 専用の随伴——インスタンス化は封じ、coverage の ctor ノードは
  // クラス初期化時のこの一度で踏む（#sealed は封印の証書としてだけ読む）。
  static readonly #sealed: IdOrder = new IdOrder();

  static isSealed(): boolean {
    return IdOrder.#sealed instanceof IdOrder;
  }

  private constructor() {}

  static compare(a: string, b: string): number {
    const pa = a.replace(/[0-9.]/g, "");
    const pb = b.replace(/[0-9.]/g, "");
    if (pa !== pb) return pa < pb ? -1 : 1;
    const na = numSegments(a);
    const nb = numSegments(b);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const da = na[i] ?? -1;
      const db = nb[i] ?? -1;
      if (da !== db) return da - db;
    }
    return 0;
  }

  static sortedUnique(values: string[], cmp: (a: string, b: string) => number = IdOrder.compare): string[] {
    return [...new Set(values)].sort(cmp);
  }
}
