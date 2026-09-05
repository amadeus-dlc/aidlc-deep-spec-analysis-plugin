import { type ComponentName } from "./component-name.ts";
import { type ElementPath } from "./element-path.ts";

// 依存参照（depends_on / dependents の 1 エントリ）。誰を指すかは参照自身が
// 答える——DD-3 の自己依存検出はコンポーネント側に移設済み（#71 波6）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ComponentReferenceParam = { component: ComponentName; element: ElementPath };

export class ComponentReference {
  readonly #component: ComponentName;
  readonly #element: ElementPath;

  private constructor(props: ComponentReferenceParam) {
    this.#component = props.component;
    this.#element = props.element;
  }

  static of(props: ComponentReferenceParam): ComponentReference {
    return new ComponentReference(props);
  }

  component(): ComponentName {
    return this.#component;
  }

  element(): ElementPath {
    return this.#element;
  }

  // DD-3: この参照が name を指すか（自己依存検出の部品）。
  pointsAt(name: ComponentName): boolean {
    return this.#component.equals(name);
  }
}
