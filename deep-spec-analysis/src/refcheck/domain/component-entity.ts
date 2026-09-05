import type { AttributeName } from "./attribute-name.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityName } from "./entity-name.ts";
import type { EntityReferences } from "./entity-references.ts";

// コンポーネントが所有するエンティティ宣言。所有の要件たる識別子の有無
// （DD-5）はエンティティ自身が判定する（#71 波6）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ComponentEntityParam = {
  name: EntityName;
  element: ElementPath;
  identifier: AttributeName | null;
  references: EntityReferences;
};

export class ComponentEntity {
  readonly #name: EntityName;
  readonly #element: ElementPath;
  readonly #identifier: AttributeName | null;
  readonly #references: EntityReferences;

  private constructor(props: ComponentEntityParam) {
    this.#name = props.name;
    this.#element = props.element;
    this.#identifier = props.identifier;
    this.#references = props.references;
  }

  static of(props: ComponentEntityParam): ComponentEntity {
    return new ComponentEntity(props);
  }

  name(): EntityName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  references(): EntityReferences {
    return this.#references;
  }

  // DD-5: 所有の要件たる識別子を持つか（未宣言・空文字は識別子なし——凍結条件）。
  hasIdentifier(): boolean {
    return this.#identifier !== null;
  }
}
