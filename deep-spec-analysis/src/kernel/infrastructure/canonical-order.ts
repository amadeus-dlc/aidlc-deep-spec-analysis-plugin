// kernelの公開facadeから共有する、識別子の正準比較と重複除去ソート。
// 数字とドットを除いた部分→数値セグメントの順に比較する。
// skipped・checked[]の順序はgoldenバイトにも影響する。

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
