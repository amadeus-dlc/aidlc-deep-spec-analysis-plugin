import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";

export class IntermediateRepresentationAttributeDeclarations {
  readonly #values: readonly IntermediateRepresentationAttributeDeclaration[];

  private constructor(values: readonly IntermediateRepresentationAttributeDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly IntermediateRepresentationAttributeDeclaration[]): IntermediateRepresentationAttributeDeclarations {
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
}
