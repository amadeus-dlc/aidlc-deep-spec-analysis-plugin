// 拡張 kind 順位表と正準ソート（NFR1、golden バイトを決める）。
// deep-spec-lib.ts からの逐語移動。v1 バックエンドの 4-kind 表とは意図的に
// 別実装のまま保つ（順序互換は tests/kind-rank.test.ts が機械証明）。

import { idCompare } from "../../kernel/domain/index.ts";
import type { Finding } from "./finding.ts";
import type { Skipped } from "./skipped.ts";

// Extended kind rank (NFR1). Preserves the relative order of the v1 kinds.
const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  unreachable: 3,
  redundancy: 4,
  "refinement-violation": 5,
  "mapping-gap": 6,
  "structure-invalid": 7,
  "reference-broken": 8,
  "consistency-mismatch": 9,
  "cross-check-disagreement": 10,
};

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const kr = (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99);
    if (kr !== 0) return kr;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export function sortSkipped(skipped: Skipped[]): Skipped[] {
  return [...skipped].sort((a, b) => {
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}
