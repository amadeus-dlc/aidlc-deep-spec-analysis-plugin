import type { AttributeDeclaration } from "./attribute-declaration.ts";
import type { AttributeDeclarations } from "./attribute-declarations.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityName } from "./entity-name.ts";
import type { RelationshipDeclarations } from "./relationship-declarations.ts";

// エンティティ宣言。属性の重複・選定・解決は属性コレクションに委ねる。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type EntityDeclarationParam = {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly attrs: AttributeDeclarations;
  readonly rels: RelationshipDeclarations;
};

export class EntityDeclaration {
  readonly #name: EntityName;
  readonly #element: ElementPath;
  readonly #attrs: AttributeDeclarations;
  readonly #rels: RelationshipDeclarations;

  private constructor(seed: EntityDeclarationParam) {
    this.#name = seed.name;
    this.#element = seed.element;
    this.#attrs = seed.attrs;
    this.#rels = seed.rels;
  }

  static of(seed: EntityDeclarationParam): EntityDeclaration {
    return new EntityDeclaration(seed);
  }

  name(): EntityName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  attrs(): AttributeDeclarations {
    return this.#attrs;
  }

  rels(): RelationshipDeclarations {
    return this.#rels;
  }

  lifecycleAttr(): AttributeDeclaration | null {
    return this.#attrs.lifecycleAttr();
  }

  attrNamed(token: string): AttributeDeclaration | null {
    return this.#attrs.named(token);
  }
}
