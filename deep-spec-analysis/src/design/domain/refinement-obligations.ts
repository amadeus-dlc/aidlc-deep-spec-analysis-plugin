import { FirstClassCollectionBase, TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
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

  protected override rebuild(values: readonly RefinementObligation[]): RefinementObligations {
    return new RefinementObligations(values);
  }

  static of(values: readonly RefinementObligation[]): RefinementObligations {
    return new RefinementObligations(values);
  }

  override map(transform: (element: RefinementObligation) => RefinementObligation): RefinementObligations {
    return this.mapTo(transform, RefinementObligations.of);
  }

  override combine(other: RefinementObligations): RefinementObligations {
    return this.combineTo(other, RefinementObligations.of);
  }

  static parse(values: readonly RefinementObligation[]): Result<RefinementObligations, ParseError> {
    return parseConstruction(() => new RefinementObligations(values));
  }

  add(value: RefinementObligation): RefinementObligations {
    return new RefinementObligations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<RefinementObligation> {
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

  // 義務 id を検査対象 id として読む（宣言順のまま）。
  targetIds(): TargetIdentifiers {
    return TargetIdentifiers.of(this.#values.map((obligation) => obligation.id().asTargetId()));
  }

  toArray(): readonly RefinementObligation[] {
    return this.#values;
  }
}
