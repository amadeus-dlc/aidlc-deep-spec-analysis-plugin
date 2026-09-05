import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

import type { IntermediateRepresentationTemporalDeclaration } from "./intermediate-representation-temporal-declaration.ts";
import { type ObligationIdentifier } from "./obligation-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationObligationDeclarationParam = { id: ObligationIdentifier; assert?: Expression; guard?: Expression; effect?: Expression; temporal?: IntermediateRepresentationTemporalDeclaration };

export class IntermediateRepresentationObligationDeclaration {
  readonly #id: ObligationIdentifier;
  readonly #assert: Expression | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: IntermediateRepresentationTemporalDeclaration | undefined;

  private constructor(props: IntermediateRepresentationObligationDeclarationParam) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal;
  }

  static parse(props: IntermediateRepresentationObligationDeclarationParam): Result<IntermediateRepresentationObligationDeclaration, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationObligationDeclaration(props));
  }

  static of(props: IntermediateRepresentationObligationDeclarationParam): IntermediateRepresentationObligationDeclaration {
    return new IntermediateRepresentationObligationDeclaration(props);
  }

  id(): ObligationIdentifier { return this.#id; }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    this.#temporal?.inspectExpressions(visitor);
  }
}
