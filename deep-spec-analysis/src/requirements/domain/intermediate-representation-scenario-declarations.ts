import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationScenarioDeclaration } from "./intermediate-representation-scenario-declaration.ts";

export class IntermediateRepresentationScenarioDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationScenarioDeclaration,
    IntermediateRepresentationScenarioDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationScenarioDeclaration>
{
  readonly #values: readonly IntermediateRepresentationScenarioDeclaration[];

  private constructor(values: readonly IntermediateRepresentationScenarioDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-scenario-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }

  static of(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }

  static parse(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): Result<IntermediateRepresentationScenarioDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationScenarioDeclarations(values));
  }

  add(value: IntermediateRepresentationScenarioDeclaration): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationScenarioDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationScenarioDeclaration[] {
    return this.#values;
  }
}
