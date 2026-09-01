import type { DesignUnitDecl } from "./design-unit-decl.ts";

export class DesignUnitDecls {
  readonly #values: readonly DesignUnitDecl[];

  private constructor(values: readonly DesignUnitDecl[]) {
    this.#values = values;
  }

  static of(values: readonly DesignUnitDecl[]): DesignUnitDecls {
    return new DesignUnitDecls([...values]);
  }

  add(value: DesignUnitDecl): DesignUnitDecls {
    return new DesignUnitDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnitDecl> {
    yield* this.#values;
  }

  toArray(): readonly DesignUnitDecl[] {
    return this.#values;
  }
}
