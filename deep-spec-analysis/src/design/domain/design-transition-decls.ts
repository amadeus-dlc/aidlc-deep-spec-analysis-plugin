import type { DesignTransitionDecl } from "./design-transition-decl.ts";

export class DesignTransitionDecls {
  readonly #values: readonly DesignTransitionDecl[];

  private constructor(values: readonly DesignTransitionDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignTransitionDecl[]): DesignTransitionDecls {
    return new DesignTransitionDecls([...values]);
  }

  add(value: DesignTransitionDecl): DesignTransitionDecls {
    return new DesignTransitionDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransitionDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignTransitionDecl[] {
    return this.#values;
  }
}
