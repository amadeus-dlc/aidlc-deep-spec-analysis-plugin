// id 様トークンの正準順序 — 英字骨格→数値セグメント比較。skipped の並びと
// checked[] の順序（= golden バイト）を決める。
//
// kernel の非公開ヘルパー（種別規律の裁定 1、2026-09-02）: facade からは出さず、
// 公開面は DP の `compareTo`（TargetIdentifier）とコレクションの正準ソート
// （TargetIdentifiers / FunctionalRequirementReferences）だけ。他の文脈は必ずその門を通る。

function numSegments(id: string): number[] {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}

export function compareCanonically(a: string, b: string): number {
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

export function sortedUniqueCanonically(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonically);
}
