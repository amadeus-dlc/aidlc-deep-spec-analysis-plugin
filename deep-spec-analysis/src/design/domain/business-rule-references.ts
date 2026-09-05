// BusinessRuleReferences — 設計要素が指す業務規則 id の列（ファーストクラスコレクション）。
// 要素は BusinessRuleReference（裁定 3-1、2026-09-03）。of は型付きの BusinessRuleReference を受け取る。

import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { BusinessRuleReference } from "./business-rule-reference.ts";

export class BusinessRuleReferences {
  readonly #values: readonly BusinessRuleReference[];

  private constructor(values: readonly BusinessRuleReference[]) {
    if (values.length > 10_000)
      throw new IllegalArgumentException({ kind: "too-many-business-rule-references", raw: values.length });
    this.#values = Object.freeze([...values]);
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
