import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { EntityReference } from "./entity-reference.ts";

export class EntityReferences
  extends FirstClassCollectionBase<EntityReference, EntityReferences>
  implements FirstClassCollection<EntityReference>
{
  readonly #values: readonly EntityReference[];

  private constructor(values: readonly EntityReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-entity-references");
  }

  protected override rebuild(values: readonly EntityReference[]): EntityReferences {
    return new EntityReferences(values);
  }

  static parse(values: readonly EntityReference[]): Result<EntityReferences, ParseError> {
    return parseConstruction(() => new EntityReferences(values));
  }

  static of(values: readonly EntityReference[]): EntityReferences {
    return new EntityReferences(values);
  }

  add(value: EntityReference): EntityReferences {
    return new EntityReferences([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<EntityReference> {
    yield* this.#values;
  }

  toArray(): readonly EntityReference[] {
    return this.#values;
  }
}
