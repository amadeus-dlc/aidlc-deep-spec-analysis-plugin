import type { DesignObligationDecl } from "./design-obligation-decl.ts";

export class DesignObligationDecls {
  readonly #values: readonly DesignObligationDecl[];

  private constructor(values: readonly DesignObligationDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignObligationDecl[]): DesignObligationDecls {
    return new DesignObligationDecls([...values]);
  }

  add(value: DesignObligationDecl): DesignObligationDecls {
    return new DesignObligationDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignObligationDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignObligationDecl[] {
    return this.#values;
  }
}
