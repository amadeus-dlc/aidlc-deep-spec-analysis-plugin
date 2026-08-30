// refcheck finding（契約2 語彙）。ペイロードはファーストクラスコレクション
// （FrRefs / TargetIds は kernel の共有語彙）で運び、描画キー順・拡張 kind
// 順位表（NFR1、golden バイトを決める）はここが所有する。v1 バックエンドの
// 4-kind 表とは意図的に別実装のまま保つ（順序互換は tests/kind-rank.test.ts
// が機械証明）。旧 catalog-order.ts の sort は Findings/Skips の集合知識へ
// 畳んだ。

import { idCompare } from "../../kernel/domain/index.ts";
import type { FrRefs, TargetIds } from "../../kernel/domain/index.ts";
import type { WitnessRefs } from "./witness-ref.ts";
import type { Skipped } from "./skipped.ts";

export interface Finding {
  kind: string;
  frRefs: FrRefs;
  targets: TargetIds;
  witness: { refs: WitnessRefs };
  unit?: string;
  detail: string;
}

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

// skip 記録のファーストクラスコレクション。正準ソート（target → reason）を
// 所有する。
export class Skips {
  readonly #values: readonly Skipped[];

  private constructor(values: readonly Skipped[]) {
    this.#values = values;
  }

  static of(values: readonly Skipped[]): Skips {
    return new Skips([...values]);
  }

  add(value: Skipped): Skips {
    return new Skips([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Skipped> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  sortedCanonically(): Skips {
    return new Skips(
      [...this.#values].sort((a, b) => {
        const c = idCompare(a.target, b.target);
        if (c !== 0) return c;
        return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
      }),
    );
  }

  toArray(): readonly Skipped[] {
    return this.#values;
  }
}
