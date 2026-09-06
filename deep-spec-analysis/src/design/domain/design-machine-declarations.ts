import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignMachineDeclaration } from "./design-machine-declaration.ts";

export class DesignMachineDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<DesignMachineDeclaration>
{
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
