import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";

import type { IntermediateRepresentationTemporalDeclaration } from "./intermediate-representation-temporal-declaration.ts";
import type { ObligationIdentifier } from "./obligation-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationObligationDeclarationParam = {
  id: ObligationIdentifier;
  assert?: Expression;
  guard?: Expression;
  effect?: Expression;
  temporal?: IntermediateRepresentationTemporalDeclaration;
};

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

  static parse(
    props: IntermediateRepresentationObligationDeclarationParam,
  ): Result<IntermediateRepresentationObligationDeclaration, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationObligationDeclaration(props));
  }

  static of(
    props: IntermediateRepresentationObligationDeclarationParam,
  ): IntermediateRepresentationObligationDeclaration {
    return new IntermediateRepresentationObligationDeclaration(props);
  }

  diagnostics(catalog: IntermediateRepresentationAttributeCatalog): ErrorMessages {
    const context = `obligation ${this.#id.asString()}`;
    const errors: string[] = [];
    this.#inspectExpressions((expression, primesAllowed) => {
      for (const message of catalog.expressionDiagnostics(expression, context, primesAllowed))
        errors.push(message.asString());
    });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  id(): ObligationIdentifier {
    return this.#id;
  }

  #inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    this.#temporal?.inspectExpressions(visitor);
  }
}
