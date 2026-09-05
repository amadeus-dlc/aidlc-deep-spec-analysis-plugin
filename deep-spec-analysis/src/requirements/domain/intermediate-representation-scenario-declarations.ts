import type { IntermediateRepresentationScenarioDeclaration } from "./intermediate-representation-scenario-declaration.ts";

export class IntermediateRepresentationScenarioDeclarations {
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
}
