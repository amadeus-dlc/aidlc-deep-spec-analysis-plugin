import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationObligationDeclaration } from "./intermediate-representation-obligation-declaration.ts";

export class IntermediateRepresentationObligationDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationObligationDeclaration,
    IntermediateRepresentationObligationDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationObligationDeclaration>
{
  readonly #values: readonly IntermediateRepresentationObligationDeclaration[];

  private constructor(values: readonly IntermediateRepresentationObligationDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-obligation-declarations",
    );
  }

  protected rebuild(
    values: readonly IntermediateRepresentationObligationDeclaration[],
  ): IntermediateRepresentationObligationDeclarations {
    return new IntermediateRepresentationObligationDeclarations(values);
  }

  static parse(
    values: readonly IntermediateRepresentationObligationDeclaration[],
  ): Result<IntermediateRepresentationObligationDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationObligationDeclarations(values));
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
