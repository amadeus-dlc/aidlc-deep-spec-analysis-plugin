import type { IrAttributeDecl } from "./ir-attribute-decl.ts";

export class IrAttributeDecls {
  readonly #values: readonly IrAttributeDecl[];

  private constructor(values: readonly IrAttributeDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrAttributeDecl[]): IrAttributeDecls {
    return new IrAttributeDecls([...values]);
  }

  add(value: IrAttributeDecl): IrAttributeDecls {
    return new IrAttributeDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrAttributeDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrAttributeDecl[] {
    return this.#values;
  }
}
