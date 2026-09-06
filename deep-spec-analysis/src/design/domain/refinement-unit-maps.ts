import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignUnitIdentifier } from "./design-unit-identifier.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";

// ユニット写像のファーストクラスコレクション。重複ユニットは最初の宣言が
// 勝つ（旧 find の凍結挙動）。
export class RefinementUnitMaps extends FirstClassCollectionBase<RefinementUnitMap, RefinementUnitMaps> {
  readonly #values: readonly RefinementUnitMap[];

  private constructor(values: readonly RefinementUnitMap[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-refinement-unit-maps");
  }

  protected rebuild(values: readonly RefinementUnitMap[]): RefinementUnitMaps {
    return new RefinementUnitMaps(values);
  }

  static of(values: readonly RefinementUnitMap[]): RefinementUnitMaps {
    return new RefinementUnitMaps(values);
  }

  static parse(values: readonly RefinementUnitMap[]): Result<RefinementUnitMaps, ParseError> {
    return parseConstruction(() => new RefinementUnitMaps(values));
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
