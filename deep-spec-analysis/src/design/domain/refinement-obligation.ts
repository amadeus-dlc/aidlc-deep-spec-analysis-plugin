import type { Expression, FunctionalRequirementReferences, TriggerName } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import type { ObligationIdentifier, ObligationNature } from "@deep-spec/requirements-domain";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementObligationParam = {
  id: ObligationIdentifier;
  nature: ObligationNature;
  functionalRequirementReferences: FunctionalRequirementReferences;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
};

export class RefinementObligation {
  readonly #id: ObligationIdentifier;
  readonly #nature: ObligationNature;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;

  private constructor(props: RefinementObligationParam) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
  }

  static parse(props: RefinementObligationParam): Result<RefinementObligation, ParseError> {
    return parseConstruction(() => new RefinementObligation(props));
  }

  static of(props: RefinementObligationParam): RefinementObligation {
    return new RefinementObligation(props);
  }

  id(): ObligationIdentifier {
    return this.#id;
  }
  nature(): ObligationNature {
    return this.#nature;
  }
  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }
  assertion(): Expression | undefined {
    return this.#assert;
  }
  trigger(): TriggerName | undefined {
    return this.#trigger;
  }
  guard(): Expression | undefined {
    return this.#guard;
  }
  effect(): Expression | undefined {
    return this.#effect;
  }
  isInvariantLike(): boolean {
    return this.#nature.isInvariant() || this.#nature.isNumeric();
  }
  isEvent(): boolean {
    return this.#nature.isEvent();
  }
  isStateTemporal(): boolean {
    return this.#nature.isStateTemporal();
  }

  eventDefinition(): { readonly trigger: TriggerName; readonly guard: Expression; readonly effect: Expression } | null {
    if (
      !this.#nature.isEvent() ||
      this.#trigger === undefined ||
      this.#guard === undefined ||
      this.#effect === undefined
    )
      return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }
}
