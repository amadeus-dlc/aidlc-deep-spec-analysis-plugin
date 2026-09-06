import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RefinementObligation } from "./refinement-obligation.ts";

// 要件義務のファーストクラスコレクション。id 索引は最後の宣言が勝つ
// （旧 new Map(...) の凍結挙動）。
export class RefinementObligations extends FirstClassCollectionBase<RefinementObligation, RefinementObligations> {
  readonly #values: readonly RefinementObligation[];

  private constructor(values: readonly RefinementObligation[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-refinement-obligations");
  }

  protected rebuild(values: readonly RefinementObligation[]): RefinementObligations {
    return new RefinementObligations(values);
  }

  static of(values: readonly RefinementObligation[]): RefinementObligations {
    return new RefinementObligations(values);
  }

  static parse(values: readonly RefinementObligation[]): Result<RefinementObligations, ParseError> {
    return parseConstruction(() => new RefinementObligations(values));
  }

  add(value: RefinementObligation): RefinementObligations {
    return new RefinementObligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementObligation> {
    yield* this.#values;
  }

  byId(id: string): RefinementObligation | undefined {
    let found: RefinementObligation | undefined;
    for (const o of this.#values) {
      if (o.id().asString() === id) found = o;
    }
    return found;
  }

  sortedCanonically(): RefinementObligations {
    return new RefinementObligations([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }

  toArray(): readonly RefinementObligation[] {
    return this.#values;
  }
}
