import type { IrObligationDecl } from "./ir-obligation-decl.ts";

export class IrObligationDecls {
  readonly #values: readonly IrObligationDecl[];

  private constructor(values: readonly IrObligationDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrObligationDecl[]): IrObligationDecls {
    return new IrObligationDecls([...values]);
  }

  add(value: IrObligationDecl): IrObligationDecls {
    return new IrObligationDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrObligationDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrObligationDecl[] {
    return this.#values;
  }
}
