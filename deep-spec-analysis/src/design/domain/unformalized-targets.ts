import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
// UnformalizedTargets — 設計 IR の unformalized[]（形式化しないと宣言した
// 対象 id）の集合。要素は TargetIdentifier、内側は KeySet（裁定 3-1、2026-09-03）。

import { KeySet, type TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import { boundedCollectionSnapshot } from "@deep-spec-analysis/kernel-infrastructure";

export class UnformalizedTargets extends FirstClassCollectionBase<TargetIdentifier, UnformalizedTargets> {
  readonly #values: KeySet<TargetIdentifier>;

  private constructor(values: readonly TargetIdentifier[]) {
    super();
    this.#values = KeySet.of(boundedCollectionSnapshot(values, 65_536, "too-many-unformalized-targets"));
  }

  protected override rebuild(values: readonly TargetIdentifier[]): UnformalizedTargets {
    return new UnformalizedTargets(values);
  }

  static of(values: readonly TargetIdentifier[]): UnformalizedTargets {
    return new UnformalizedTargets(values);
  }

  static parse(values: readonly TargetIdentifier[]): Result<UnformalizedTargets, ParseError> {
    return parseConstruction(() => new UnformalizedTargets(values));
  }

  add(value: TargetIdentifier): UnformalizedTargets {
    if (this.#values.has(value)) return this;
    return new UnformalizedTargets([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<TargetIdentifier> {
    yield* this.#values;
  }

  covers(target: TargetIdentifier): boolean {
    return this.#values.has(target);
  }

  toArray(): readonly TargetIdentifier[] {
    return this.#values.toArray();
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.toArray().map((v) => v.asString());
  }
}
