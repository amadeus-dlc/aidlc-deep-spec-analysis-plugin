import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { IntermediateRepresentationScenarioDeclaration } from "./intermediate-representation-scenario-declaration.ts";

export class IntermediateRepresentationScenarioDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<IntermediateRepresentationScenarioDeclaration>
{
  readonly #values: readonly IntermediateRepresentationScenarioDeclaration[];

  private constructor(values: readonly IntermediateRepresentationScenarioDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }

  add(value: IntermediateRepresentationScenarioDeclaration): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IntermediateRepresentationScenarioDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly IntermediateRepresentationScenarioDeclaration[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
