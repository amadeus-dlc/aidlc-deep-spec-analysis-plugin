import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";

export class DesignAttributeDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<DesignAttributeDeclaration>
{
  readonly #values: readonly DesignAttributeDeclaration[];

  private constructor(values: readonly DesignAttributeDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignAttributeDeclaration[]): DesignAttributeDeclarations {
    return new DesignAttributeDeclarations(values);
  }

  add(value: DesignAttributeDeclaration): DesignAttributeDeclarations {
    return new DesignAttributeDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignAttributeDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignAttributeDeclaration[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
