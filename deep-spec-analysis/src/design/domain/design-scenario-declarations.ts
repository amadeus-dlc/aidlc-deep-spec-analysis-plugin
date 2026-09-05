import type { DesignScenarioDeclaration } from "./design-scenario-declaration.ts";

export class DesignScenarioDeclarations {
  readonly #values: readonly DesignScenarioDeclaration[];

  private constructor(values: readonly DesignScenarioDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignScenarioDeclaration[]): DesignScenarioDeclarations {
    return new DesignScenarioDeclarations(values);
  }

  add(value: DesignScenarioDeclaration): DesignScenarioDeclarations {
    return new DesignScenarioDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignScenarioDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignScenarioDeclaration[] {
    return this.#values;
  }
}
