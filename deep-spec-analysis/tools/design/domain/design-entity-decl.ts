import type { DesignAttributeDecl } from "./design-attribute-decl.ts";
import { DesignAttributeDecls } from "./design-attribute-decls.ts";
import { type DesignEntityName } from "./design-entity-name.ts";

// 契約3 設計 IR のエンティティ宣言（well-formedness 検査材料）。属性の座標
// （`<entity>.<attribute>`）と同名属性の重複は宣言自身の知識——判事は文言
// （凍結面）だけを所有する（#71 波13）。
export class DesignEntityDecl {
  readonly #name: DesignEntityName;
  readonly #attributes: DesignAttributeDecls;

  private constructor(props: { name: DesignEntityName; attributes: DesignAttributeDecls }) {
    this.#name = props.name;
    this.#attributes = props.attributes;
  }

  static reconstitute(props: { name: DesignEntityName; attributes: DesignAttributeDecls }): DesignEntityDecl {
    return new DesignEntityDecl(props);
  }

  name(): DesignEntityName {
    return this.#name;
  }

  attributes(): DesignAttributeDecls {
    return this.#attributes;
  }

  // 属性を宣言順に訪ね、座標と「既に同名を見たか」を渡す（重複は最初の
  // 出現のあとの出現に立つ——凍結順）。
  inspectAttributes(visitor: (coordinate: string, attribute: DesignAttributeDecl, duplicated: boolean) => void): void {
    const seen = new Set<string>();
    for (const attribute of this.#attributes) {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
    }
  }
}
