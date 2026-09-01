import type { DesignMachineDecl } from "./design-machine-decl.ts";

export class DesignMachineDecls {
  readonly #values: readonly DesignMachineDecl[];

  private constructor(values: readonly DesignMachineDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignMachineDecl[]): DesignMachineDecls {
    return new DesignMachineDecls([...values]);
  }

  add(value: DesignMachineDecl): DesignMachineDecls {
    return new DesignMachineDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignMachineDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignMachineDecl[] {
    return this.#values;
  }
}
