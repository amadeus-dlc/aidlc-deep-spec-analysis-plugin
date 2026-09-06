import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { EntityReference } from "./entity-reference.ts";

export class EntityReferences implements FirstClassCollection, IterableFirstClassCollection<EntityReference> {
  readonly #values: readonly EntityReference[];

  private constructor(values: readonly EntityReference[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly EntityReference[]): EntityReferences {
    return new EntityReferences(values);
  }

  add(value: EntityReference): EntityReferences {
    return new EntityReferences([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EntityReference> {
    yield* this.#values;
  }

  toArray(): readonly EntityReference[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
