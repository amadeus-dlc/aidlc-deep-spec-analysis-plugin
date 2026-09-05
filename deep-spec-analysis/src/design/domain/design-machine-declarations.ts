import type { DesignMachineDeclaration } from "./design-machine-declaration.ts";

export class DesignMachineDeclarations {
  readonly #values: readonly DesignMachineDeclaration[];

  private constructor(values: readonly DesignMachineDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignMachineDeclaration[]): DesignMachineDeclarations {
    return new DesignMachineDeclarations(values);
  }

  add(value: DesignMachineDeclaration): DesignMachineDeclarations {
    return new DesignMachineDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignMachineDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignMachineDeclaration[] {
    return this.#values;
  }
}
