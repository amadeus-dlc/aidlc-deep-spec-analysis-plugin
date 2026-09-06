import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignUnitIdentifier } from "./design-unit-identifier.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";

// ユニット写像のファーストクラスコレクション。重複ユニットは最初の宣言が
// 勝つ（旧 find の凍結挙動）。
export class RefinementUnitMaps implements FirstClassCollection, IterableFirstClassCollection<RefinementUnitMap> {
  readonly #values: readonly RefinementUnitMap[];

  private constructor(values: readonly RefinementUnitMap[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly RefinementUnitMap[]): RefinementUnitMaps {
    return new RefinementUnitMaps(values);
  }

  add(value: RefinementUnitMap): RefinementUnitMaps {
    return new RefinementUnitMaps([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementUnitMap> {
    yield* this.#values;
  }

  mapOf(unit: DesignUnitIdentifier): RefinementUnitMap | undefined {
    return this.#values.find((m) => m.isForUnit(unit));
  }

  toArray(): readonly RefinementUnitMap[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
