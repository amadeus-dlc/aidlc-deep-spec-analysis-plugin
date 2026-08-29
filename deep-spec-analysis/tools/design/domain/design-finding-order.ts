// 設計バックエンドの kind 順位表（11 kind・未知は 99）と正準ソート。
// v1 の 4-kind 表とは意図的に別実装のまま保つ（統一しない——バイト安全優先。
// 順序互換は tests/kind-rank.test.ts が機械証明）。tiebreak は v1 と異なり
// unit が kind の直後に入る。逐語移動。

import { idCompare } from "../../kernel/domain/index.ts";
import type { DesignFinding, DesignSkipped } from "./design-finding.ts";

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

function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 99;
}

export function sortDesignFindings(findings: readonly DesignFinding[]): DesignFinding[] {
  return [...findings].sort((a, b) => {
    const kr = rankOf(a.kind) - rankOf(b.kind);
    if (kr !== 0) return kr;
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export function sortDesignSkipped(skipped: readonly DesignSkipped[]): DesignSkipped[] {
  return [...skipped].sort((a, b) => {
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}
