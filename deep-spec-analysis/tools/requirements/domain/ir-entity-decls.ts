import type { IrEntityDecl } from "./ir-entity-decl.ts";

export class IrEntityDecls {
  readonly #values: readonly IrEntityDecl[];

  private constructor(values: readonly IrEntityDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrEntityDecl[]): IrEntityDecls {
    return new IrEntityDecls([...values]);
  }

  add(value: IrEntityDecl): IrEntityDecls {
    return new IrEntityDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrEntityDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrEntityDecl[] {
    return this.#values;
  }
}
