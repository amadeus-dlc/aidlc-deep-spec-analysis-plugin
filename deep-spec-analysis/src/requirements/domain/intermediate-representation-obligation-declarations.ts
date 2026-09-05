import type { IntermediateRepresentationObligationDeclaration } from "./intermediate-representation-obligation-declaration.ts";

export class IntermediateRepresentationObligationDeclarations {
  readonly #values: readonly IntermediateRepresentationObligationDeclaration[];

  private constructor(values: readonly IntermediateRepresentationObligationDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(
    values: readonly IntermediateRepresentationObligationDeclaration[],
  ): IntermediateRepresentationObligationDeclarations {
    return new IntermediateRepresentationObligationDeclarations(values);
  }

  add(value: IntermediateRepresentationObligationDeclaration): IntermediateRepresentationObligationDeclarations {
    return new IntermediateRepresentationObligationDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IntermediateRepresentationObligationDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationObligationDeclaration[] {
    return this.#values;
  }
}
