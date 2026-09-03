// FrRefs — 義務・シナリオ・finding が指す要件 id の列（ファーストクラス
// コレクション）。要素は RequirementId（裁定 3-1、2026-09-03——生 string の列
// ではない）。of は DP の門、reconstitute は文書と parser の生 id 材料から。
// 正準一意化（`sortedUnique`）は finding の frRefs 面の凍結正準形。

import { sortedUniqueCanonically } from "./canonical-order.ts";
import { RequirementId } from "./requirement-id.ts";

export class FrRefs {
  readonly #values: readonly RequirementId[];

  private constructor(values: readonly RequirementId[]) {
    this.#values = values;
  }

  static of(values: readonly RequirementId[]): FrRefs {
    return new FrRefs([...values]);
  }

  static reconstitute(raws: readonly string[]): FrRefs {
    return new FrRefs(raws.map((raw) => RequirementId.reconstitute(raw)));
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
    return FrRefs.reconstitute(sortedUniqueCanonically(this.toStrings()));
  }

  toArray(): readonly RequirementId[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ・生 id 材料専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
