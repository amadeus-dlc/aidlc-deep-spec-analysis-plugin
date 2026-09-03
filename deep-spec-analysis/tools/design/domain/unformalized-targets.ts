// UnformalizedTargets — 設計 IR の unformalized[]（形式化しないと宣言した
// 対象 id）の集合。要素は TargetId、内側は KeySet（裁定 3-1、2026-09-03）。

import { KeySet, TargetId } from "../../kernel/domain/index.ts";

export class UnformalizedTargets {
  readonly #values: KeySet<TargetId>;

  private constructor(values: KeySet<TargetId>) {
    this.#values = values;
  }

  static of(values: readonly TargetId[]): UnformalizedTargets {
    return new UnformalizedTargets(KeySet.of(values));
  }

  static reconstitute(raws: readonly string[]): UnformalizedTargets {
    return new UnformalizedTargets(KeySet.of(raws.map((raw) => TargetId.reconstitute(raw))));
  }

  add(value: TargetId): UnformalizedTargets {
    return new UnformalizedTargets(this.#values.with(value));
  }

  *[Symbol.iterator](): Iterator<TargetId> {
    yield* this.#values;
  }

  covers(target: TargetId): boolean {
    return this.#values.has(target);
  }

  toArray(): readonly TargetId[] {
    return this.#values.toArray();
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.toArray().map((v) => v.asString());
  }
}
