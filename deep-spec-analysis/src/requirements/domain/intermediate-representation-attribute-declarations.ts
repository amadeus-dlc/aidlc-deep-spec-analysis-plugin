import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";

export class IntermediateRepresentationAttributeDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<IntermediateRepresentationAttributeDeclaration>
{
  readonly #values: readonly IntermediateRepresentationAttributeDeclaration[];

  private constructor(values: readonly IntermediateRepresentationAttributeDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }

  add(value: IntermediateRepresentationAttributeDeclaration): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IntermediateRepresentationAttributeDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationAttributeDeclaration[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
