// v1 バックエンドの kind 順位表（4 kind・未知は 9）と正準ソート。
// 拡張 11-kind 表とは意図的に別実装のまま保つ（統一しない——バイト安全優先。
// 順序互換は tests/kind-rank.test.ts が機械証明）。逐語移動。

import { idCompare } from "../../kernel/domain/index.ts";
import type { VerificationFinding, VerificationSkipped } from "./verification-finding.ts";

const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  "cross-check-disagreement": 3,
};

function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 9;
}

export function sortVerificationFindings(findings: readonly VerificationFinding[]): VerificationFinding[] {
  return [...findings].sort((a, b) => {
    const kr = rankOf(a.kind) - rankOf(b.kind);
    if (kr !== 0) return kr;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export function sortVerificationSkipped(skipped: readonly VerificationSkipped[]): VerificationSkipped[] {
  return [...skipped].sort((a, b) => {
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}
