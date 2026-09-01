import type { Finding } from "./finding.ts";

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

// (finding.ts の kind 順位表と同一——lockstep は tests/kind-rank.test.ts が機械証明)
// kind は任意文字列なので、素の index アクセスだと "toString" 等が prototype の
// 継承プロパティを拾い NaN 比較になる。所有プロパティのみで順位を引く。
function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 99;
}

// finding のファーストクラスコレクション。正準ソート（kind 順位 → targets →
// detail）という集合の知識を所有する。
export class Findings {
  readonly #values: readonly Finding[];

  private constructor(values: readonly Finding[]) {
    this.#values = values;
  }

  static of(values: readonly Finding[]): Findings {
    return new Findings([...values]);
  }

  add(value: Finding): Findings {
    return new Findings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Finding> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  sortedCanonically(): Findings {
    return new Findings(
      [...this.#values].sort((a, b) => {
        const kr = rankOf(a.kind) - rankOf(b.kind);
        if (kr !== 0) return kr;
        const ta = a.targets.joined(",");
        const tb = b.targets.joined(",");
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
      }),
    );
  }

  toArray(): readonly Finding[] {
    return this.#values;
  }
}
