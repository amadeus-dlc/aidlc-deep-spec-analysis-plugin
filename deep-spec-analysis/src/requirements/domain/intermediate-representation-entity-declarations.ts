import type { IntermediateRepresentationEntityDeclaration } from "./intermediate-representation-entity-declaration.ts";

export class IntermediateRepresentationEntityDeclarations {
  readonly #values: readonly IntermediateRepresentationEntityDeclaration[];

  private constructor(values: readonly IntermediateRepresentationEntityDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(
    values: readonly IntermediateRepresentationEntityDeclaration[],
  ): IntermediateRepresentationEntityDeclarations {
    return new IntermediateRepresentationEntityDeclarations(values);
  }

  add(value: IntermediateRepresentationEntityDeclaration): IntermediateRepresentationEntityDeclarations {
    return new IntermediateRepresentationEntityDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IntermediateRepresentationEntityDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationEntityDeclaration[] {
    return this.#values;
  }
}
