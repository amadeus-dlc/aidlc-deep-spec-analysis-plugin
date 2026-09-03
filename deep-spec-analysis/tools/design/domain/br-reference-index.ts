// BrReferenceIndex — rules.md が宣言する業務規則 id の集合（brRef の逆引き
// 検証の材料）。要素は BrRef、内側は KeySet（裁定 3-1、2026-09-03）。

import { KeySet } from "../../kernel/domain/index.ts";
import { BrRef } from "./br-ref.ts";

export class BrReferenceIndex {
  readonly #ids: KeySet<BrRef>;

  private constructor(ids: KeySet<BrRef>) {
    this.#ids = ids;
  }

  static fromRules(rulesMarkdown: string): BrReferenceIndex {
    const ids: BrRef[] = [];
    for (const m of rulesMarkdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g)) ids.push(BrRef.reconstitute(m[0]));
    return new BrReferenceIndex(KeySet.of(ids));
  }

  has(br: BrRef): boolean {
    return this.#ids.has(br);
  }

  // 境界: 凍結文言の列挙順（文字列順）。
  sortedIds(): string[] {
    return this.#ids.toArray().map((id) => id.asString()).sort();
  }
}
