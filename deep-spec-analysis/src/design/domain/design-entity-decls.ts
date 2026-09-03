import type { DesignEntityDecl } from "./design-entity-decl.ts";

export class DesignEntityDecls {
  readonly #values: readonly DesignEntityDecl[];

  private constructor(values: readonly DesignEntityDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignEntityDecl[]): DesignEntityDecls {
    return new DesignEntityDecls([...values]);
  }

  add(value: DesignEntityDecl): DesignEntityDecls {
    return new DesignEntityDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignEntityDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignEntityDecl[] {
    return this.#values;
  }
}
