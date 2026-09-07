import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import {
  canonicalStringify,
  combinedHash,
  hashOfNullable,
  hashOfString,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
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
    return ErrorMessages.collect(this.diagnosticStrings(catalog).map(ErrorMessage.parse));
  }

  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(catalog: IntermediateRepresentationAttributeCatalog): string[] {
    const context = `obligation ${this.#id.asString()}`;
    const errors: string[] = [];
    this.#inspectExpressions((expression, primesAllowed) => {
      errors.push(...catalog.expressionDiagnosticStrings(expression, context, primesAllowed));
    });
    return errors;
  }

  id(): ObligationIdentifier {
    return this.#id;
  }

  equals(other: IntermediateRepresentationObligationDeclaration): boolean {
    const expressionEqual = (left: Expression | undefined, right: Expression | undefined): boolean =>
      left === undefined
        ? right === undefined
        : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    return (
      this.#id.equals(other.#id) &&
      expressionEqual(this.#assert, other.#assert) &&
      expressionEqual(this.#guard, other.#guard) &&
      expressionEqual(this.#effect, other.#effect) &&
      (this.#temporal === undefined
        ? other.#temporal === undefined
        : other.#temporal !== undefined && this.#temporal.equals(other.#temporal))
    );
  }

  hashCode(): number {
    const expressionHash = (expression: Expression | undefined): number =>
      hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    return combinedHash([
      this.#id.hashCode(),
      expressionHash(this.#assert),
      expressionHash(this.#guard),
      expressionHash(this.#effect),
      hashOfNullable(this.#temporal, (temporal) => temporal.hashCode()),
    ]);
  }

  #inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    this.#temporal?.inspectExpressions(visitor);
  }
}
