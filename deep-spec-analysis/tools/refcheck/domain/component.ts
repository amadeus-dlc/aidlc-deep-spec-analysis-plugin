import { ComponentEntities } from "./component-entities.ts";
import { ComponentRefs } from "./component-refs.ts";
import { type ComponentRef } from "./component-ref.ts";
import { type ComponentName } from "./component-name.ts";
import { type ElementPath } from "./element-path.ts";

// components.md のコンポーネント宣言。名の形（DD-1 の PascalCase）と自己依存
// の検出（DD-3）は宣言自身が所有する（#71 波6）。
export class Component {
  readonly #name: ComponentName;
  readonly #element: ElementPath;
  readonly #dependsOn: ComponentRefs;
  readonly #dependents: ComponentRefs;
  readonly #entities: ComponentEntities;

  private constructor(props: {
    name: ComponentName;
    element: ElementPath;
    dependsOn: ComponentRefs;
    dependents: ComponentRefs;
    entities: ComponentEntities;
  }) {
    this.#name = props.name;
    this.#element = props.element;
    this.#dependsOn = props.dependsOn;
    this.#dependents = props.dependents;
    this.#entities = props.entities;
  }

  static reconstitute(props: {
    name: ComponentName;
    element: ElementPath;
    dependsOn: ComponentRefs;
    dependents: ComponentRefs;
    entities: ComponentEntities;
  }): Component {
    return new Component(props);
  }

  name(): ComponentName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  dependsOn(): ComponentRefs {
    return this.#dependsOn;
  }

  dependents(): ComponentRefs {
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
  selfReferences(): ComponentRef[] {
    return [...this.#dependsOn, ...this.#dependents].filter((r) => r.pointsAt(this.#name));
  }
}
