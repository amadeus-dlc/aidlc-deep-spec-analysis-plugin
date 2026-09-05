import type { ComponentReference } from "./component-reference.ts";
import { type ComponentName } from "./component-name.ts";

// 依存参照（depends_on / dependents）のファーストクラスコレクション。
export class ComponentReferences {
  readonly #values: readonly ComponentReference[];

  private constructor(values: readonly ComponentReference[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly ComponentReference[]): ComponentReferences {
    return new ComponentReferences(values);
  }

  add(value: ComponentReference): ComponentReferences {
    return new ComponentReferences([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentReference> {
    yield* this.#values;
  }

  // DD-4 の対称性検査：この参照面が name を挙げているか。
  listsComponent(name: ComponentName): boolean {
    return this.#values.some((r) => r.component().equals(name));
  }

  toArray(): readonly ComponentReference[] {
    return this.#values;
  }
}
