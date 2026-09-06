import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { IntermediateRepresentationObligationDeclaration } from "./intermediate-representation-obligation-declaration.ts";

export class IntermediateRepresentationObligationDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<IntermediateRepresentationObligationDeclaration>
{
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
