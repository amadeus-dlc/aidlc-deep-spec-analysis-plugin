// BusinessRuleReferenceIndex — rules.md が宣言する業務規則 id の集合（brRef の逆引き
// 検証の材料）。要素は BusinessRuleReference、内側は KeySet（裁定 3-1、2026-09-03）。

import { KeySet } from "@deep-spec/kernel-domain";
import { BusinessRuleReference } from "./business-rule-reference.ts";

export class BusinessRuleReferenceIndex {
  readonly #ids: KeySet<BusinessRuleReference>;

  private constructor(ids: KeySet<BusinessRuleReference>) {
    this.#ids = ids;
  }

  static fromRules(rulesMarkdown: string): BusinessRuleReferenceIndex {
    const ids: BusinessRuleReference[] = [];
    for (const m of rulesMarkdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g)) ids.push(BusinessRuleReference.of(m[0]));
    return new BusinessRuleReferenceIndex(KeySet.of(ids));
  }

  has(br: BusinessRuleReference): boolean {
    return this.#ids.has(br);
  }

  // 境界: 凍結文言の列挙順（文字列順）。
  sortedIds(): string[] {
    return this.#ids.toArray().map((id) => id.asString()).sort();
  }
}
