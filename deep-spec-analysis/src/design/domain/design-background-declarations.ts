import type { DesignBackgroundDeclaration } from "./design-background-declaration.ts";

export class DesignBackgroundDeclarations {
  readonly #values: readonly DesignBackgroundDeclaration[];

  private constructor(values: readonly DesignBackgroundDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignBackgroundDeclaration[]): DesignBackgroundDeclarations {
    return new DesignBackgroundDeclarations(values);
  }

  add(value: DesignBackgroundDeclaration): DesignBackgroundDeclarations {
    return new DesignBackgroundDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignBackgroundDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundDeclaration[] {
    return this.#values;
  }
}
