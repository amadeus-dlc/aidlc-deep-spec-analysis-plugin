import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
// BusinessRuleReferences — 設計要素が指す業務規則 id の列（ファーストクラスコレクション）。
// 要素は BusinessRuleReference（裁定 3-1、2026-09-03）。of は型付きの BusinessRuleReference を受け取る。

import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { BusinessRuleReference } from "./business-rule-reference.ts";

export class BusinessRuleReferences extends FirstClassCollectionBase<BusinessRuleReference, BusinessRuleReferences> {
  readonly #values: readonly BusinessRuleReference[];

  private constructor(values: readonly BusinessRuleReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 10_000, "too-many-business-rule-references");
  }

  protected rebuild(values: readonly BusinessRuleReference[]): BusinessRuleReferences {
    return new BusinessRuleReferences(values);
  }

  static of(values: readonly BusinessRuleReference[]): BusinessRuleReferences {
    return new BusinessRuleReferences(values);
  }

  static parse(values: readonly BusinessRuleReference[]): Result<BusinessRuleReferences, ParseError> {
    return parseConstruction(() => new BusinessRuleReferences(values));
  }

  add(value: BusinessRuleReference): BusinessRuleReferences {
    return new BusinessRuleReferences([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<BusinessRuleReference> {
    yield* this.#values;
  }

  toArray(): readonly BusinessRuleReference[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
