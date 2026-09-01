import type { ComponentEntity } from "./component-entity.ts";
import { type EntityName } from "./entity-name.ts";

export class ComponentEntities {
  readonly #values: readonly ComponentEntity[];

  private constructor(values: readonly ComponentEntity[]) {
    this.#values = values;
  }

  static of(values: readonly ComponentEntity[]): ComponentEntities {
    return new ComponentEntities([...values]);
  }

  add(value: ComponentEntity): ComponentEntities {
    return new ComponentEntities([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentEntity> {
    yield* this.#values;
  }

  // DD-6：owner がこの名前のエンティティを宣言しているか。
  declaresEntity(name: EntityName): boolean {
    return this.#values.some((e) => e.name.equals(name));
  }

  toArray(): readonly ComponentEntity[] {
    return this.#values;
  }
}
