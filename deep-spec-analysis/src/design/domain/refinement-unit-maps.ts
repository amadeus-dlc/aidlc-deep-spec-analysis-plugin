import { DesignUnitIdentifier } from "@deep-spec/design-domain";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";

// ユニット写像のファーストクラスコレクション。重複ユニットは最初の宣言が
// 勝つ（旧 find の凍結挙動）。
export class RefinementUnitMaps {
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
}
