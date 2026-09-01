import { RuleDecl } from "./rule-decl.ts";

export class RuleDecls {
  readonly #values: readonly RuleDecl[];

  private constructor(values: readonly RuleDecl[]) {
    this.#values = values;
  }

  static of(values: readonly RuleDecl[]): RuleDecls {
    return new RuleDecls([...values]);
  }

  add(value: RuleDecl): RuleDecls {
    return new RuleDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RuleDecl> {
    yield* this.#values;
  }

  toArray(): readonly RuleDecl[] {
    return this.#values;
  }
}
