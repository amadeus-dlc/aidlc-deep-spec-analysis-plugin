import { RelDecl } from "./rel-decl.ts";

export class RelDecls {
  readonly #values: readonly RelDecl[];

  private constructor(values: readonly RelDecl[]) {
    this.#values = values;
  }

  static of(values: readonly RelDecl[]): RelDecls {
    return new RelDecls([...values]);
  }

  add(value: RelDecl): RelDecls {
    return new RelDecls([...this.#values, value]);
  }

  concat(other: RelDecls): RelDecls {
    return new RelDecls([...this.#values, ...other.#values]);
  }

  *[Symbol.iterator](): Iterator<RelDecl> {
    yield* this.#values;
  }

  toArray(): readonly RelDecl[] {
    return this.#values;
  }
}
