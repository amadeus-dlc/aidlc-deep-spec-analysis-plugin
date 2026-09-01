import type { DesignBackgroundDecl } from "./design-background-decl.ts";

export class DesignBackgroundDecls {
  readonly #values: readonly DesignBackgroundDecl[];

  private constructor(values: readonly DesignBackgroundDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignBackgroundDecl[]): DesignBackgroundDecls {
    return new DesignBackgroundDecls([...values]);
  }

  add(value: DesignBackgroundDecl): DesignBackgroundDecls {
    return new DesignBackgroundDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignBackgroundDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundDecl[] {
    return this.#values;
  }
}
