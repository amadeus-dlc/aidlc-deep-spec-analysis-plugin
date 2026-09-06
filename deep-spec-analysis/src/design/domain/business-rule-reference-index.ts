import type { BusinessRuleReferences } from "./business-rule-references.ts";
// BusinessRuleReferenceIndex — rules.md が宣言する業務規則 id の集合（brRef の逆引き
// 検証の材料）。要素は BusinessRuleReference、内側は KeySet（裁定 3-1、2026-09-03）。

import { KeySet } from "@deep-spec-analysis/kernel-domain";
import type { BusinessRuleReference } from "./business-rule-reference.ts";

export class BusinessRuleReferenceIndex {
  readonly #ids: KeySet<BusinessRuleReference>;

  private constructor(ids: KeySet<BusinessRuleReference>) {
    this.#ids = ids;
  }

  static of(ids: BusinessRuleReferences): BusinessRuleReferenceIndex {
    return new BusinessRuleReferenceIndex(KeySet.of(ids));
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
