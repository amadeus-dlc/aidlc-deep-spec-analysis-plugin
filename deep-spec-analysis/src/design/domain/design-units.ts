import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignUnit } from "./design-unit.ts";

// 設計ユニットのファーストクラスコレクション。ユニット名昇順の整列
// （DesignModel の組成不変条件）という集合の知識を所有する。
export class DesignUnits extends FirstClassCollectionBase<DesignUnit, DesignUnits> {
  readonly #values: readonly DesignUnit[];

  private constructor(values: readonly DesignUnit[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-units");
  }

  protected rebuild(values: readonly DesignUnit[]): DesignUnits {
    return new DesignUnits(values);
  }

  static of(values: readonly DesignUnit[]): DesignUnits {
    return new DesignUnits(values);
  }

  static parse(values: readonly DesignUnit[]): Result<DesignUnits, ParseError> {
    return parseConstruction(() => new DesignUnits(values));
  }

  add(value: DesignUnit): DesignUnits {
    return new DesignUnits([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnit> {
    yield* this.#values;
  }

  sortedByName(): DesignUnits {
    return new DesignUnits([...this.#values].sort((a, b) => (a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0)));
  }

  toArray(): readonly DesignUnit[] {
    return this.#values;
  }
}
