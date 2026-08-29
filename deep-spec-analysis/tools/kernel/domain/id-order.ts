// id の正準順序 — 英字骨格→数値セグメント比較。skipped ソートと checked[]
// の順序（= golden バイト）を決める比較器。deep-spec-lib.ts からの逐語移動。

function numSegments(id: string): number[] {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}

export function idCompare(a: string, b: string): number {
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

export function sortedUnique(values: string[], cmp: (a: string, b: string) => number): string[] {
  return [...new Set(values)].sort(cmp);
}
