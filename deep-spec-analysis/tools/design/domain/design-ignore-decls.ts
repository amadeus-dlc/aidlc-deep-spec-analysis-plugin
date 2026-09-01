import type { DesignIgnoreDecl } from "./design-ignore-decl.ts";

export class DesignIgnoreDecls {
  readonly #values: readonly DesignIgnoreDecl[];

  private constructor(values: readonly DesignIgnoreDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignIgnoreDecl[]): DesignIgnoreDecls {
    return new DesignIgnoreDecls([...values]);
  }

  add(value: DesignIgnoreDecl): DesignIgnoreDecls {
    return new DesignIgnoreDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignIgnoreDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignIgnoreDecl[] {
    return this.#values;
  }
}
