import type { AttributeMapping } from "./attribute-mapping.ts";

// attrMap 宣言のファーストクラスコレクション（宣言順を保持——重複検出の
// gap 発火順は plan が宣言順に歩くことで凍結される）。
export class AttributeMappings {
  readonly #values: readonly AttributeMapping[];

  private constructor(values: readonly AttributeMapping[]) {
    this.#values = values;
  }

  static of(values: readonly AttributeMapping[]): AttributeMappings {
    return new AttributeMappings([...values]);
  }

  add(value: AttributeMapping): AttributeMappings {
    return new AttributeMappings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeMapping> {
    yield* this.#values;
  }

  toArray(): readonly AttributeMapping[] {
    return this.#values;
  }
}
