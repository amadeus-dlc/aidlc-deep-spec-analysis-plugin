import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationBackgroundDeclaration } from "./intermediate-representation-background-declaration.ts";

export class IntermediateRepresentationBackgroundDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationBackgroundDeclaration,
    IntermediateRepresentationBackgroundDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationBackgroundDeclaration>
{
  readonly #values: readonly IntermediateRepresentationBackgroundDeclaration[];

  private constructor(values: readonly IntermediateRepresentationBackgroundDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-background-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationBackgroundDeclaration[],
  ): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }

  static parse(
    values: readonly IntermediateRepresentationBackgroundDeclaration[],
  ): Result<IntermediateRepresentationBackgroundDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationBackgroundDeclarations(values));
  }

  static of(
    values: readonly IntermediateRepresentationBackgroundDeclaration[],
  ): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }

  add(value: IntermediateRepresentationBackgroundDeclaration): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationBackgroundDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationBackgroundDeclaration[] {
    return this.#values;
  }
}
