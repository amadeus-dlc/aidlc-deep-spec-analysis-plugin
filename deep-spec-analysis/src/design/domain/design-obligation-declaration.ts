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
import type { BusinessRuleReferences } from "./business-rule-references.ts";
import type { DesignAttributeCatalog } from "./design-attribute-catalog.ts";
import type { DesignObligationIdentifier } from "./design-obligation-identifier.ts";
import type { DesignObligationOrigin } from "./design-obligation-origin.ts";
import { sameExpression, sameIterable, sameOptional } from "./value-equality.ts";

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
  readonly #temporal:
    | { readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression }
    | undefined;

  private constructor(props: DesignObligationDeclarationParam) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal =
      props.temporal === undefined
        ? undefined
        : {
            ...props.temporal,
            ...(props.temporal.assert !== undefined
              ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() }
              : {}),
            ...(props.temporal.from !== undefined
              ? { from: ExpressionTree.of(props.temporal.from).asExpression() }
              : {}),
            ...(props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}),
          };
  }

  static parse(props: DesignObligationDeclarationParam): Result<DesignObligationDeclaration, ParseError> {
    return parseConstruction(() => new DesignObligationDeclaration(props));
  }

  static of(props: DesignObligationDeclarationParam): DesignObligationDeclaration {
    return new DesignObligationDeclaration(props);
  }

  equals(other: DesignObligationDeclaration): boolean {
    return (
      this.#id.equals(other.#id) &&
      sameOptional(this.#origin, other.#origin, (left, right) => left.equals(right)) &&
      sameOptional(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) =>
        sameIterable(left, right, (a, b) => a.equals(b)),
      ) &&
      sameExpression(this.#assert, other.#assert) &&
      sameExpression(this.#guard, other.#guard) &&
      sameExpression(this.#effect, other.#effect) &&
      sameOptional(
        this.#temporal,
        other.#temporal,
        (left, right) =>
          sameExpression(left.assert, right.assert) &&
          sameExpression(left.from, right.from) &&
          sameExpression(left.to, right.to),
      )
    );
  }

  hashCode(): number {
    const hashExpression = (expression: Expression | undefined): number =>
      hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#origin, (origin) => origin.hashCode()),
      hashOfNullable(this.#businessRuleReferences, (references) => references.hashCode()),
      hashExpression(this.#assert),
      hashExpression(this.#guard),
      hashExpression(this.#effect),
      hashOfNullable(this.#temporal, (temporal) =>
        combinedHash([hashExpression(temporal.assert), hashExpression(temporal.from), hashExpression(temporal.to)]),
      ),
    ]);
  }

  diagnostics(catalog: DesignAttributeCatalog | null): ErrorMessages {
    const context = `obligation ${this.#id.asString()}`;
    const errors: string[] = [];
    if (this.#origin?.isRules() === true && this.#businessRuleReferences === undefined)
      errors.push(`${context}: origin "rules" requires brRefs`);
    if (catalog !== null)
      this.#inspectExpressions((expression, primesAllowed) => {
        catalog.expressionDiagnostics(expression, context, primesAllowed).foldLeft(errors, (acc, message) => {
          acc.push(message.asString());
          return acc;
        });
      });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  id(): DesignObligationIdentifier {
    return this.#id;
  }
  businessRuleReferences(): BusinessRuleReferences | undefined {
    return this.#businessRuleReferences;
  }

  #inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined) visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined) visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined) visitor(this.#temporal.to, false);
  }
}
