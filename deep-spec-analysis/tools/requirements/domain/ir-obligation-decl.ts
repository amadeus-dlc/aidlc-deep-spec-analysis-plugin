import type { Expression } from "../../kernel/domain/index.ts";
import type { IrTemporalDecl } from "./ir-temporal-decl.ts";
import { type ObligationId } from "./obligation-id.ts";

export class IrObligationDecl {
  readonly #id: ObligationId;
  readonly #assert: Expression | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: IrTemporalDecl | undefined;

  private constructor(props: { id: ObligationId; assert?: Expression; guard?: Expression; effect?: Expression; temporal?: IrTemporalDecl }) {
    this.#id = props.id;
    this.#assert = props.assert;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal;
  }

  static reconstitute(props: { id: ObligationId; assert?: Expression; guard?: Expression; effect?: Expression; temporal?: IrTemporalDecl }): IrObligationDecl {
    return new IrObligationDecl(props);
  }

  id(): ObligationId { return this.#id; }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined) visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined) visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined) visitor(this.#temporal.to, false);
  }
}
