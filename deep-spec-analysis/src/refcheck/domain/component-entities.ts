import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ComponentEntity } from "./component-entity.ts";
import type { EntityName } from "./entity-name.ts";

export class ComponentEntities
  extends FirstClassCollectionBase<ComponentEntity, ComponentEntities>
  implements FirstClassCollection<ComponentEntity>
{
  readonly #values: readonly ComponentEntity[];

  private constructor(values: readonly ComponentEntity[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-component-entities");
  }

  protected override rebuild(values: readonly ComponentEntity[]): ComponentEntities {
    return new ComponentEntities(values);
  }

  static parse(values: readonly ComponentEntity[]): Result<ComponentEntities, ParseError> {
    return parseConstruction(() => new ComponentEntities(values));
  }

  static of(values: readonly ComponentEntity[]): ComponentEntities {
    return new ComponentEntities(values);
  }

  add(value: ComponentEntity): ComponentEntities {
    return new ComponentEntities([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<ComponentEntity> {
    yield* this.#values;
  }

  // DD-6：owner がこの名前のエンティティを宣言しているか。
  declaresEntity(name: EntityName): boolean {
    return this.#values.some((e) => e.name().equals(name));
  }

  toArray(): readonly ComponentEntity[] {
    return this.#values;
  }
}
