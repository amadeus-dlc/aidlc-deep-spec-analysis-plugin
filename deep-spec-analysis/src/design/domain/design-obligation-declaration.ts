import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

import { BusinessRuleReferences } from "./business-rule-references.ts";
import { type DesignObligationIdentifier } from "./design-obligation-identifier.ts";
import { type DesignObligationOrigin } from "./design-obligation-origin.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignObligationDeclarationParam = {
  id: DesignObligationIdentifier;
  origin?: DesignObligationOrigin;
  businessRuleReferences?: BusinessRuleReferences;
  assert?: Expression;
  guard?: Expression;
  effect?: Expression;
  temporal?: { readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
};

export class DesignObligationDeclaration {
  readonly #id: DesignObligationIdentifier;
  readonly #origin: DesignObligationOrigin | undefined;
  readonly #businessRuleReferences: BusinessRuleReferences | undefined;
  readonly #assert: Expression | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: { readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression } | undefined;

  private constructor(props: DesignObligationDeclarationParam) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...(props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {}),
      ...(props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {}),
      ...(props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}),
    };
  }

  static parse(props: DesignObligationDeclarationParam): Result<DesignObligationDeclaration, ParseError> {
    return parseConstruction(() => new DesignObligationDeclaration(props));
  }

  static of(props: DesignObligationDeclarationParam): DesignObligationDeclaration {
    return new DesignObligationDeclaration(props);
  }

  id(): DesignObligationIdentifier { return this.#id; }
  businessRuleReferences(): BusinessRuleReferences | undefined { return this.#businessRuleReferences; }

  missesRequiredBusinessRuleReferences(): boolean {
    return this.#origin?.isRules() === true && this.#businessRuleReferences === undefined;
  }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined) visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined) visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined) visitor(this.#temporal.to, false);
  }
}
