import type { ComponentEntities } from "./component-entities.ts";
import type { ComponentName } from "./component-name.ts";
import type { ComponentReference } from "./component-reference.ts";
import type { ComponentReferences } from "./component-references.ts";
import type { ElementPath } from "./element-path.ts";

// components.md のコンポーネント宣言。名の形（DD-1 の PascalCase）と自己依存
// の検出（DD-3）は宣言自身が所有する（#71 波6）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ComponentParam = {
  name: ComponentName;
  element: ElementPath;
  dependsOn: ComponentReferences;
  dependents: ComponentReferences;
  entities: ComponentEntities;
};

export class Component {
  readonly #name: ComponentName;
  readonly #element: ElementPath;
  readonly #dependsOn: ComponentReferences;
  readonly #dependents: ComponentReferences;
  readonly #entities: ComponentEntities;

  private constructor(props: ComponentParam) {
    this.#name = props.name;
    this.#element = props.element;
    this.#dependsOn = props.dependsOn;
    this.#dependents = props.dependents;
    this.#entities = props.entities;
  }

  static of(props: ComponentParam): Component {
    return new Component(props);
  }

  name(): ComponentName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  dependsOn(): ComponentReferences {
    return this.#dependsOn;
  }

  dependents(): ComponentReferences {
    return this.#dependents;
  }

  entities(): ComponentEntities {
    return this.#entities;
  }

  // DD-1: コンポーネント名は PascalCase でなければならない。
  nameIsPascalCase(): boolean {
    return /^[A-Z][A-Za-z0-9]*$/.test(this.#name.asString());
  }

  // DD-3: 自分自身を指す依存参照（depends_on → dependents の走査順——凍結）。
  selfReferences(): ComponentReference[] {
    return [...this.#dependsOn, ...this.#dependents].filter((r) => r.pointsAt(this.#name));
  }
}
