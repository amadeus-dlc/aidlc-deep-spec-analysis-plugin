import type { DesignAttributeDecl } from "./design-attribute-decl.ts";

export class DesignAttributeDecls {
  readonly #values: readonly DesignAttributeDecl[];

  private constructor(values: readonly DesignAttributeDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignAttributeDecl[]): DesignAttributeDecls {
    return new DesignAttributeDecls([...values]);
  }

  add(value: DesignAttributeDecl): DesignAttributeDecls {
    return new DesignAttributeDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignAttributeDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignAttributeDecl[] {
    return this.#values;
  }
}
