import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";
import type { IntermediateRepresentationAttributeDeclarations } from "./intermediate-representation-attribute-declarations.ts";
import type { IntermediateRepresentationEntityName } from "./intermediate-representation-entity-name.ts";

// 契約1 要件 IR のエンティティ宣言（well-formedness 検査材料）。属性の座標
// （`<entity>.<attribute>`）と同名属性の重複は宣言自身の知識——判事は文言
// （凍結面）だけを所有する（#71 波14、design 側の波13 と対）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationEntityDeclarationParam = {
  name: IntermediateRepresentationEntityName;
  attributes: IntermediateRepresentationAttributeDeclarations;
};

export class IntermediateRepresentationEntityDeclaration {
  readonly #name: IntermediateRepresentationEntityName;
  readonly #attributes: IntermediateRepresentationAttributeDeclarations;

  private constructor(props: IntermediateRepresentationEntityDeclarationParam) {
    this.#name = props.name;
    this.#attributes = props.attributes;
  }

  static of(props: IntermediateRepresentationEntityDeclarationParam): IntermediateRepresentationEntityDeclaration {
    return new IntermediateRepresentationEntityDeclaration(props);
  }

  name(): IntermediateRepresentationEntityName {
    return this.#name;
  }

  attributes(): IntermediateRepresentationAttributeDeclarations {
    return this.#attributes;
  }

  // 属性を宣言順に訪ね、座標と「既に同名を見たか」を渡す（重複は 2 回目以降の
  // 出現に立つ——凍結順）。
  inspectAttributes(
    visitor: (
      coordinate: string,
      attribute: IntermediateRepresentationAttributeDeclaration,
      duplicated: boolean,
    ) => void,
  ): void {
    const seen = new Set<string>();
    for (const attribute of this.#attributes) {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
    }
  }
}
