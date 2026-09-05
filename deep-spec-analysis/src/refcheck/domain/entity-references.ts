import type { EntityReference } from "./entity-reference.ts";

export class EntityReferences {
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
}
