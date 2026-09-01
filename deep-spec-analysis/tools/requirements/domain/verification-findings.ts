import type { VerificationFinding } from "./verification-finding.ts";

// v1 バックエンドの kind 順位表（4 kind・未知は 9）と正準ソート。
// 拡張 11-kind 表とは意図的に別実装のまま保つ（統一しない——バイト安全優先。
// 順序互換は tests/kind-rank.test.ts が機械証明）。旧
// verification-finding-order.ts から吸収し、コレクションだけが使う。
const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  "cross-check-disagreement": 3,
};

function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 9;
}

function sortVerificationFindings(findings: readonly VerificationFinding[]): VerificationFinding[] {
  return [...findings].sort((a, b) => {
    const kr = rankOf(a.kind) - rankOf(b.kind);
    if (kr !== 0) return kr;
    const ta = a.targets.joined(",");
    const tb = b.targets.joined(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export class VerificationFindings {
  readonly #values: readonly VerificationFinding[];

  private constructor(values: readonly VerificationFinding[]) {
    this.#values = values;
  }

  static of(values: readonly VerificationFinding[]): VerificationFindings {
    return new VerificationFindings([...values]);
  }

  add(value: VerificationFinding): VerificationFindings {
    return new VerificationFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<VerificationFinding> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationFindings {
    return new VerificationFindings(sortVerificationFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly VerificationFinding[] {
    return this.#values;
  }
}
