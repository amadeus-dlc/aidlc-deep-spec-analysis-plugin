import type { DesignScenarioDecl } from "./design-scenario-decl.ts";

export class DesignScenarioDecls {
  readonly #values: readonly DesignScenarioDecl[];

  private constructor(values: readonly DesignScenarioDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignScenarioDecl[]): DesignScenarioDecls {
    return new DesignScenarioDecls([...values]);
  }

  add(value: DesignScenarioDecl): DesignScenarioDecls {
    return new DesignScenarioDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignScenarioDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignScenarioDecl[] {
    return this.#values;
  }
}
