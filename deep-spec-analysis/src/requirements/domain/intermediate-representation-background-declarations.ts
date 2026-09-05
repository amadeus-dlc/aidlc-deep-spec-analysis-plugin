import type { IntermediateRepresentationBackgroundDeclaration } from "./intermediate-representation-background-declaration.ts";

export class IntermediateRepresentationBackgroundDeclarations {
  readonly #values: readonly IntermediateRepresentationBackgroundDeclaration[];

  private constructor(values: readonly IntermediateRepresentationBackgroundDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly IntermediateRepresentationBackgroundDeclaration[]): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }

  add(value: IntermediateRepresentationBackgroundDeclaration): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IntermediateRepresentationBackgroundDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationBackgroundDeclaration[] {
    return this.#values;
  }
}
