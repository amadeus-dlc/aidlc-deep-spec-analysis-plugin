import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";

export class IntermediateRepresentationAttributeDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationAttributeDeclaration,
    IntermediateRepresentationAttributeDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationAttributeDeclaration>
{
  readonly #values: readonly IntermediateRepresentationAttributeDeclaration[];

  private constructor(values: readonly IntermediateRepresentationAttributeDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-attribute-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }

  static parse(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): Result<IntermediateRepresentationAttributeDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationAttributeDeclarations(values));
  }

  static of(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }

  add(value: IntermediateRepresentationAttributeDeclaration): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationAttributeDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationAttributeDeclaration[] {
    return this.#values;
  }
}
