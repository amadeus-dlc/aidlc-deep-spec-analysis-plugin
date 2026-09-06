import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
// UnformalizedTargets — 設計 IR の unformalized[]（形式化しないと宣言した
// 対象 id）の集合。要素は TargetIdentifier、内側は KeySet（裁定 3-1、2026-09-03）。

import { KeySet, type TargetIdentifier } from "@deep-spec-analysis/kernel-domain";

export class UnformalizedTargets implements FirstClassCollection, IterableFirstClassCollection<TargetIdentifier> {
  readonly #values: KeySet<TargetIdentifier>;

  private constructor(values: KeySet<TargetIdentifier>) {
    this.#values = values;
  }

  static of(values: readonly TargetIdentifier[]): UnformalizedTargets {
    return new UnformalizedTargets(KeySet.of(values));
  }

  add(value: TargetIdentifier): UnformalizedTargets {
    return new UnformalizedTargets(this.#values.with(value));
  }

  *[Symbol.iterator](): Iterator<TargetIdentifier> {
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

  isEmpty(): boolean {
    return this.#values.isEmpty();
  }
}
