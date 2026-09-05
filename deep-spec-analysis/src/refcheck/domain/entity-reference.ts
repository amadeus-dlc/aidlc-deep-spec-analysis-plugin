import type { ComponentName } from "./component-name.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityName } from "./entity-name.ts";

// 成分実体が宣言する他実体への参照 1 件——参照先の実体、その所有成分、宣言
// 位置。DD-2／DD-6 は所有成分と実体の宣言を成分表に問う（#71 波26）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type EntityReferenceParam = { entity: EntityName; ownedBy: ComponentName; element: ElementPath };

export class EntityReference {
  readonly #entity: EntityName;
  readonly #ownedBy: ComponentName;
  readonly #element: ElementPath;

  private constructor(props: EntityReferenceParam) {
    this.#entity = props.entity;
    this.#ownedBy = props.ownedBy;
    this.#element = props.element;
  }

  static of(props: EntityReferenceParam): EntityReference {
    return new EntityReference(props);
  }

  entity(): EntityName {
    return this.#entity;
  }

  ownedBy(): ComponentName {
    return this.#ownedBy;
  }

  element(): ElementPath {
    return this.#element;
  }
}
