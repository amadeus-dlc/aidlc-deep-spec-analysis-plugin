import type { IrBackgroundDecl } from "./ir-background-decl.ts";

export class IrBackgroundDecls {
  readonly #values: readonly IrBackgroundDecl[];

  private constructor(values: readonly IrBackgroundDecl[]) {
    this.#values = values;
  }

  static of(values: readonly IrBackgroundDecl[]): IrBackgroundDecls {
    return new IrBackgroundDecls([...values]);
  }

  add(value: IrBackgroundDecl): IrBackgroundDecls {
    return new IrBackgroundDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IrBackgroundDecl> {
    yield* this.#values;
  }

  toArray(): readonly IrBackgroundDecl[] {
    return this.#values;
  }
}
