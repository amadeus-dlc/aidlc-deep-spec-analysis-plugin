import type { ComponentRef } from "./component-ref.ts";
import { type ComponentName } from "./component-name.ts";

// 依存参照（depends_on / dependents）のファーストクラスコレクション。
export class ComponentRefs {
  readonly #values: readonly ComponentRef[];

  private constructor(values: readonly ComponentRef[]) {
    this.#values = values;
  }

  static of(values: readonly ComponentRef[]): ComponentRefs {
    return new ComponentRefs([...values]);
  }

  add(value: ComponentRef): ComponentRefs {
    return new ComponentRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentRef> {
    yield* this.#values;
  }

  // DD-4 の対称性検査：この参照面が name を挙げているか。
  listsComponent(name: ComponentName): boolean {
    return this.#values.some((r) => r.component.equals(name));
  }

  toArray(): readonly ComponentRef[] {
    return this.#values;
  }
}
