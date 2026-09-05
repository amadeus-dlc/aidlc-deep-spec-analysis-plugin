// FunctionalRequirementReferences — 義務・シナリオ・finding が指す要件 id の列（ファーストクラス
// コレクション）。要素は RequirementId（裁定 3-1、2026-09-03——生 string の列
// ではない）。of は型付きの要素を受け取る。
// 正準一意化（`sortedUnique`）は finding の frRefs 面の凍結正準形。

import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import { RequirementId } from "./requirement-id.ts";

export class FunctionalRequirementReferences {
  readonly #values: readonly RequirementId[];

  private constructor(values: readonly RequirementId[]) {
    // 1要素が持つ要件参照の処理予算は10,000件。コピーの前に確認する。
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "too-many-functional-requirement-references", raw: values.length });
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly RequirementId[]): FunctionalRequirementReferences {
    return new FunctionalRequirementReferences(values);
  }

  add(value: RequirementId): FunctionalRequirementReferences {
    return new FunctionalRequirementReferences([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RequirementId> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  sortedUnique(): FunctionalRequirementReferences {
    const unique = new Map(this.#values.map((value) => [value.asString(), value]));
    return new FunctionalRequirementReferences([...unique.values()].sort((a, b) => a.compareTo(b)));
  }

  toArray(): readonly RequirementId[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ・生 id 材料専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
