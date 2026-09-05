import type { DesignIgnoreDeclaration } from "./design-ignore-declaration.ts";

export class DesignIgnoreDeclarations {
  readonly #values: readonly DesignIgnoreDeclaration[];

  private constructor(values: readonly DesignIgnoreDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignIgnoreDeclaration[]): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations(values);
  }

  add(value: DesignIgnoreDeclaration): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignIgnoreDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignIgnoreDeclaration[] {
    return this.#values;
  }
}
