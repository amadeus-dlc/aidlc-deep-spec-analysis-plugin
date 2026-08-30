// BrReferenceIndex — rules.md が宣言する BR id の集合（設計側の逆トレーサ
// ビリティ語彙）。`BR<n>.<m>` の字面が id であり、markdown の構造には依存
// しないため、抽出はドメインの語彙知識として持つ。
// 旧 design-ir-valid の brIds からの逐語移植。

export class BrReferenceIndex {
  readonly #ids: Set<string>;

  private constructor(ids: Set<string>) {
    this.#ids = ids;
  }

  static fromRules(rulesMarkdown: string): BrReferenceIndex {
    const ids = new Set<string>();
    for (const m of rulesMarkdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g)) ids.add(m[0]);
    return new BrReferenceIndex(ids);
  }

  has(br: string): boolean {
    return this.#ids.has(br);
  }

  sortedIds(): string[] {
    return [...this.#ids].sort();
  }
}
