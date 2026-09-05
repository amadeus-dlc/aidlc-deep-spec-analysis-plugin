// FrRefs — 義務・シナリオ・finding が指す要件 id の列（ファーストクラス
// コレクション）。要素は RequirementId（裁定 3-1、2026-09-03——生 string の列
// ではない）。of は型付きの要素を受け取る。
// 正準一意化（`sortedUnique`）は finding の frRefs 面の凍結正準形。

import { sortedUniqueCanonically } from "@deep-spec/kernel-infrastructure";
import { RequirementId } from "./requirement-id.ts";

export class FrRefs {
  readonly #values: readonly RequirementId[];

  private constructor(values: readonly RequirementId[]) {
    this.#values = values;
  }

  static of(values: readonly RequirementId[]): FrRefs {
    return new FrRefs([...values]);
  }

  add(value: RequirementId): FrRefs {
    return new FrRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RequirementId> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  sortedUnique(): FrRefs {
    return FrRefs.of(Array.from(sortedUniqueCanonically(this.toStrings()), (raw) => RequirementId.of(raw)));
  }

  toArray(): readonly RequirementId[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ・生 id 材料専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
