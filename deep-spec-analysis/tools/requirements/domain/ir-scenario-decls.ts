import type { IrScenarioDecl } from "./ir-scenario-decl.ts";

export class IrScenarioDecls {
  readonly #values: readonly IrScenarioDecl[];

  private constructor(values: readonly IrScenarioDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrScenarioDecl[]): IrScenarioDecls {
    return new IrScenarioDecls([...values]);
  }

  add(value: IrScenarioDecl): IrScenarioDecls {
    return new IrScenarioDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrScenarioDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrScenarioDecl[] {
    return this.#values;
  }
}
