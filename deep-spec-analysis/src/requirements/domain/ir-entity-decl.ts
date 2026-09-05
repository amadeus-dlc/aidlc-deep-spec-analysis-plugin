import type { IrAttributeDecl } from "./ir-attribute-decl.ts";
import { IrAttributeDecls } from "./ir-attribute-decls.ts";
import { IrEntityName } from "./ir-entity-name.ts";

// 契約1 要件 IR のエンティティ宣言（well-formedness 検査材料）。属性の座標
// （`<entity>.<attribute>`）と同名属性の重複は宣言自身の知識——判事は文言
// （凍結面）だけを所有する（#71 波14、design 側の波13 と対）。
export class IrEntityDecl {
  readonly #name: IrEntityName;
  readonly #attributes: IrAttributeDecls;

  private constructor(props: Parameters<typeof IrEntityDecl.of>[0]) {
    this.#name = props.name;
    this.#attributes = props.attributes;
  }

  static of(props: { name: IrEntityName; attributes: IrAttributeDecls }): IrEntityDecl {
    return new IrEntityDecl(props);
  }

  name(): IrEntityName {
    return this.#name;
  }

  attributes(): IrAttributeDecls {
    return this.#attributes;
  }

  // 属性を宣言順に訪ね、座標と「既に同名を見たか」を渡す（重複は 2 回目以降の
  // 出現に立つ——凍結順）。
  inspectAttributes(visitor: (coordinate: string, attribute: IrAttributeDecl, duplicated: boolean) => void): void {
    const seen = new Set<string>();
    for (const attribute of this.#attributes) {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
    }
  }
}
