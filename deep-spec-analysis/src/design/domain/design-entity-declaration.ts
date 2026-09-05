import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
import { DesignAttributeDeclarations } from "./design-attribute-declarations.ts";
import { type DesignEntityName } from "./design-entity-name.ts";

// 契約3 設計 IR のエンティティ宣言（well-formedness 検査材料）。属性の座標
// （`<entity>.<attribute>`）と同名属性の重複は宣言自身の知識——判事は文言
// （凍結面）だけを所有する（#71 波13）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignEntityDeclarationParam = { name: DesignEntityName; description?: string; attributes: DesignAttributeDeclarations };

export class DesignEntityDeclaration {
  readonly #name: DesignEntityName;
  // 執筆者向けの説明文（契約3 の任意項目——ツールは読まず、lowered 文書へ逐語で運ぶ）。
  readonly #description: string | undefined;
  readonly #attributes: DesignAttributeDeclarations;

  private constructor(props: DesignEntityDeclarationParam) {
    this.#name = props.name;
    this.#description = props.description;
    this.#attributes = props.attributes;
  }

  static of(props: DesignEntityDeclarationParam): DesignEntityDeclaration {
    return new DesignEntityDeclaration(props);
  }

  name(): DesignEntityName {
    return this.#name;
  }

  // 境界: lowered 文書の描画専用。
  description(): string | undefined {
    return this.#description;
  }

  attributes(): DesignAttributeDeclarations {
    return this.#attributes;
  }

  // 属性を宣言順に訪ね、座標と「既に同名を見たか」を渡す（重複は最初の
  // 出現のあとの出現に立つ——凍結順）。
  inspectAttributes(visitor: (coordinate: string, attribute: DesignAttributeDeclaration, duplicated: boolean) => void): void {
    const seen = new Set<string>();
    for (const attribute of this.#attributes) {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
    }
  }
}
