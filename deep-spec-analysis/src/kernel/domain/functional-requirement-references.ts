import type { FirstClassCollection } from "./first-class-collection.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";
// FunctionalRequirementReferences — 義務・シナリオ・finding が指す要件 id の列（ファーストクラス
// コレクション）。要素は RequirementIdentifier（裁定 3-1、2026-09-03——生 string の列
// ではない）。of は型付きの要素を受け取る。
// 正準一意化（`sortedUnique`）は finding の frRefs 面の凍結正準形。

import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RequirementIdentifier } from "./requirement-identifier.ts";

const MAX_FUNCTIONAL_REQUIREMENT_REFERENCES = 10_000;

export class FunctionalRequirementReferences
  extends FirstClassCollectionBase<RequirementIdentifier, FunctionalRequirementReferences>
  implements FirstClassCollection<RequirementIdentifier>
{
  readonly #values: readonly RequirementIdentifier[];

  private constructor(values: readonly RequirementIdentifier[]) {
    super();
    // 1要素が持つ要件参照の処理予算は10,000件。コピーの前に確認する。
    this.#values = boundedCollectionSnapshot(
      values,
      MAX_FUNCTIONAL_REQUIREMENT_REFERENCES,
      "too-many-functional-requirement-references",
    );
  }

  protected override rebuild(values: readonly RequirementIdentifier[]): FunctionalRequirementReferences {
    return new FunctionalRequirementReferences(values);
  }

  static parse(values: readonly RequirementIdentifier[]): Result<FunctionalRequirementReferences, ParseError> {
    return parseConstruction(() => new FunctionalRequirementReferences(values));
  }

  static of(values: readonly RequirementIdentifier[]): FunctionalRequirementReferences {
    return new FunctionalRequirementReferences(values);
  }

  add(value: RequirementIdentifier): FunctionalRequirementReferences {
    return new FunctionalRequirementReferences([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<RequirementIdentifier> {
    yield* this.#values;
  }

  override isEmpty(): boolean {
    return this.#values.length === 0;
  }

  sortedUnique(): FunctionalRequirementReferences {
    const unique = new Map(this.#values.map((value) => [value.asString(), value]));
    return new FunctionalRequirementReferences([...unique.values()].sort((a, b) => a.compareTo(b)));
  }

  toArray(): readonly RequirementIdentifier[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ・生 id 材料専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
