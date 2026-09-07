import { FirstClassCollectionBase, type SkipReason, UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";

// 設計ユニットのファーストクラスコレクション。ユニット名昇順の整列
// （DesignModel の組成不変条件）という集合の知識を所有する。
export class DesignUnits extends FirstClassCollectionBase<DesignUnit, DesignUnits> {
  readonly #values: readonly DesignUnit[];

  private constructor(values: readonly DesignUnit[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-units");
  }

  protected override rebuild(values: readonly DesignUnit[]): DesignUnits {
    return new DesignUnits(values);
  }

  static of(values: readonly DesignUnit[]): DesignUnits {
    return new DesignUnits(values);
  }

  override map(transform: (element: DesignUnit) => DesignUnit): DesignUnits {
    return this.mapTo(transform, DesignUnits.of);
  }

  override combine(other: DesignUnits): DesignUnits {
    return this.combineTo(other, DesignUnits.of);
  }

  static parse(values: readonly DesignUnit[]): Result<DesignUnits, ParseError> {
    return parseConstruction(() => new DesignUnits(values));
  }

  add(value: DesignUnit): DesignUnits {
    return new DesignUnits([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignUnit> {
    yield* this.#values;
  }

  // 全ユニットの全対象を同じ理由・同じ説明で skip した列（IR 版不一致・
  // backend 不在で model ごと未検証になったときの証跡）。ユニット順は保つ。
  allTargetsSkipped(reason: SkipReason, detail: string): DesignSkips {
    return this.#values.reduce(
      (skips, unit) =>
        skips.combine(DesignSkips.forTargets(unit.allTargets(), UnitName.of(unit.name()), reason, detail)),
      DesignSkips.of([]),
    );
  }

  sortedByName(): DesignUnits {
    return new DesignUnits([...this.#values].sort((a, b) => (a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0)));
  }

  toArray(): readonly DesignUnit[] {
    return this.#values;
  }
}
