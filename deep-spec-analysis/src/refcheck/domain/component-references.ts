import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ComponentName } from "./component-name.ts";
import type { ComponentReference } from "./component-reference.ts";

// 依存参照（depends_on / dependents）のファーストクラスコレクション。
export class ComponentReferences
  extends FirstClassCollectionBase<ComponentReference, ComponentReferences>
  implements FirstClassCollection<ComponentReference>
{
  readonly #values: readonly ComponentReference[];

  private constructor(values: readonly ComponentReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-component-references");
  }

  protected rebuild(values: readonly ComponentReference[]): ComponentReferences {
    return new ComponentReferences(values);
  }

  static parse(values: readonly ComponentReference[]): Result<ComponentReferences, ParseError> {
    return parseConstruction(() => new ComponentReferences(values));
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
