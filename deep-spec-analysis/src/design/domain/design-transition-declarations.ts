import type { DesignTransitionDeclaration } from "./design-transition-declaration.ts";

export class DesignTransitionDeclarations {
  readonly #values: readonly DesignTransitionDeclaration[];

  private constructor(values: readonly DesignTransitionDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignTransitionDeclaration[]): DesignTransitionDeclarations {
    return new DesignTransitionDeclarations(values);
  }

  add(value: DesignTransitionDeclaration): DesignTransitionDeclarations {
    return new DesignTransitionDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransitionDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignTransitionDeclaration[] {
    return this.#values;
  }
}
