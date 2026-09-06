import {
  ErrorMessage,
  ErrorMessages,
  FirstClassCollectionBase,
  KeySet,
  TargetIdentifier,
} from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { BusinessRuleReferences } from "./business-rule-references.ts";
import type { UnformalizedTargets } from "./unformalized-targets.ts";
// BusinessRuleReferenceIndex — rules.md が宣言する業務規則 id の集合（brRef の逆引き
// 検証の材料）。要素は BusinessRuleReference、内側は KeySet（裁定 3-1、2026-09-03）。

import type { BusinessRuleReference } from "./business-rule-reference.ts";

export class BusinessRuleReferenceIndex extends FirstClassCollectionBase<
  BusinessRuleReference,
  BusinessRuleReferenceIndex
> {
  readonly #ids: KeySet<BusinessRuleReference>;

  private constructor(ids: KeySet<BusinessRuleReference>) {
    super();
    this.#ids = ids;
  }

  protected rebuild(values: readonly BusinessRuleReference[]): BusinessRuleReferenceIndex {
    return new BusinessRuleReferenceIndex(KeySet.of(values));
  }

  *[Symbol.iterator](): Iterator<BusinessRuleReference> {
    yield* this.#ids;
  }

  static of(ids: BusinessRuleReferences): BusinessRuleReferenceIndex {
    return new BusinessRuleReferenceIndex(KeySet.of(ids));
  }

  static parse(ids: BusinessRuleReferences): Result<BusinessRuleReferenceIndex, ParseError> {
    return parseConstruction(() => new BusinessRuleReferenceIndex(KeySet.of(ids)));
  }

  diagnostics(used: KeySet<BusinessRuleReference>, unformalized: UnformalizedTargets): ErrorMessages {
    const errors: string[] = [];
    for (const reference of [...used].sort((a, b) =>
      a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0,
    )) {
      if (!this.has(reference)) errors.push(`brRef "${reference.asString()}" does not exist in rules.md`);
    }
    for (const reference of [...this.#ids].sort((a, b) =>
      a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0,
    )) {
      if (!used.has(reference) && !unformalized.covers(TargetIdentifier.of(reference.asString())))
        errors.push(
          `BR coverage: rule ${reference.asString()} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation`,
        );
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  has(br: BusinessRuleReference): boolean {
    return this.#ids.has(br);
  }

  // 境界: 凍結文言の列挙順（文字列順）。
  sortedIds(): string[] {
    return this.#ids
      .toArray()
      .map((id) => id.asString())
      .sort();
  }
}
