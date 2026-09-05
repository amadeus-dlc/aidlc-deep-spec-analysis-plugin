import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

import type { IrTemporalDecl } from "./ir-temporal-decl.ts";
import { type ObligationId } from "./obligation-id.ts";

export class IrObligationDecl {
  readonly #id: ObligationId;
  readonly #assert: Expression | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: IrTemporalDecl | undefined;

  private constructor(props: Parameters<typeof IrObligationDecl.of>[0]) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal;
  }

  static of(props: { id: ObligationId; assert?: Expression; guard?: Expression; effect?: Expression; temporal?: IrTemporalDecl }): IrObligationDecl {
    return new IrObligationDecl(props);
  }

  id(): ObligationId { return this.#id; }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    this.#temporal?.inspectExpressions(visitor);
  }
}
