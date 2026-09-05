import { type Expression, ExpressionTree, type TriggerName } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import type { BusinessRuleReferences } from "./business-rule-references.ts";
import type { DesignTransitionIdentifier } from "./design-transition-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignTransitionDeclarationParam = {
  id: DesignTransitionIdentifier;
  from?: string;
  to?: string;
  trigger?: TriggerName;
  businessRuleReferences?: BusinessRuleReferences;
  guard?: Expression;
  effect?: Expression;
};

export class DesignTransitionDeclaration {
  readonly #id: DesignTransitionIdentifier;
  readonly #from: string | undefined;
  readonly #to: string | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #businessRuleReferences: BusinessRuleReferences | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;

  private constructor(props: DesignTransitionDeclarationParam) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
  }

  static parse(props: DesignTransitionDeclarationParam): Result<DesignTransitionDeclaration, ParseError> {
    return parseConstruction(() => new DesignTransitionDeclaration(props));
  }

  static of(props: DesignTransitionDeclarationParam): DesignTransitionDeclaration {
    return new DesignTransitionDeclaration(props);
  }

  id(): DesignTransitionIdentifier {
    return this.#id;
  }
  fromState(): string | undefined {
    return this.#from;
  }
  toState(): string | undefined {
    return this.#to;
  }
  trigger(): TriggerName | undefined {
    return this.#trigger;
  }
  businessRuleReferences(): BusinessRuleReferences | undefined {
    return this.#businessRuleReferences;
  }
  guard(): Expression | undefined {
    return this.#guard;
  }
  effect(): Expression | undefined {
    return this.#effect;
  }

  stateEntries(): readonly (readonly ["from" | "to", string | undefined])[] {
    return [
      ["from", this.#from],
      ["to", this.#to],
    ];
  }

  cellKey(): string | null {
    return this.#from !== undefined && this.#trigger !== undefined ? `${this.#from}|${this.#trigger.asString()}` : null;
  }

  assignsPrimedReferenceTo(path: string): boolean {
    return this.#effect !== undefined && ExpressionTree.of(this.#effect).assignsPrimed(path);
  }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
  }
}
