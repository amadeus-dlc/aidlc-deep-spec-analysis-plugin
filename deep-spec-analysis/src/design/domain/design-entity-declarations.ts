import type { DesignEntityDeclaration } from "./design-entity-declaration.ts";

export class DesignEntityDeclarations {
  readonly #values: readonly DesignEntityDeclaration[];

  private constructor(values: readonly DesignEntityDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignEntityDeclaration[]): DesignEntityDeclarations {
    return new DesignEntityDeclarations(values);
  }

  add(value: DesignEntityDeclaration): DesignEntityDeclarations {
    return new DesignEntityDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignEntityDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignEntityDeclaration[] {
    return this.#values;
  }
}
