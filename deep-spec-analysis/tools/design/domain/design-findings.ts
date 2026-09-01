import type { DesignFinding } from "./design-finding.ts";

// 設計バックエンドの kind 順位表（11 kind・未知は 99）。v1 の 4-kind 表とは
// 意図的に別実装のまま保つ（統一しない——バイト安全優先。順序互換は
// tests/kind-rank.test.ts が機械証明）。tiebreak は v1 と異なり unit が kind の
// 直後に入る。旧 design-finding-order.ts から吸収し、コレクションだけが使う。
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

// (finding.ts の kind 順位表と同一——lockstep は tests/kind-rank.test.ts が機械証明)
function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 99;
}

function sortDesignFindings(findings: readonly DesignFinding[]): DesignFinding[] {
  return [...findings].sort((a, b) => {
    const kr = rankOf(a.kind) - rankOf(b.kind);
    if (kr !== 0) return kr;
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    const ta = a.targets.joined(",");
    const tb = b.targets.joined(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

// finding / skip のファーストクラスコレクション。契約2 拡張（設計 11-kind
// 順位）の正準ソートという集合の知識を所有する。

export class DesignFindings {
  readonly #values: readonly DesignFinding[];

  private constructor(values: readonly DesignFinding[]) {
    this.#values = values;
  }

  static of(values: readonly DesignFinding[]): DesignFindings {
    return new DesignFindings([...values]);
  }

  add(value: DesignFinding): DesignFindings {
    return new DesignFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignFinding> {
    yield* this.#values;
  }

  sortedCanonically(): DesignFindings {
    return new DesignFindings(sortDesignFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly DesignFinding[] {
    return this.#values;
  }
}
