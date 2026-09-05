import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferences, TriggerName } from "@deep-spec/kernel-domain";
import { ObligationNature } from "@deep-spec/kernel-domain";
// 義務（EARS nature 付き）。分類・event 完全性・式の役割は義務自身が所有し、
// コンパイラは外部形式への射影だけを担う。

import { ObligationId } from "./obligation-id.ts";

type TemporalExpressions = {
  readonly pattern: string;
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
};

export class Obligation {
  readonly #id: ObligationId;
  readonly #nature: ObligationNature;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #ears: string | undefined;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: TemporalExpressions | undefined;

  private constructor(props: Parameters<typeof Obligation.of>[0]) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#ears = props.ears;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...(props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {}),
      ...(props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {}),
      ...(props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}),
    };
  }

  static of(props: {
    id: ObligationId;
    nature: ObligationNature;
    functionalRequirementReferences: FunctionalRequirementReferences;
    ears?: string;
    assert?: Expression;
    trigger?: TriggerName;
    guard?: Expression;
    effect?: Expression;
    temporal?: TemporalExpressions;
  }): Obligation {
    return new Obligation(props);
  }

  id(): ObligationId { return this.#id; }
  nature(): ObligationNature { return this.#nature; }
  functionalRequirementReferences(): FunctionalRequirementReferences { return this.#functionalRequirementReferences; }
  ears(): string | undefined { return this.#ears; }
  assertion(): Expression | undefined { return this.#assert; }
  trigger(): TriggerName | undefined { return this.#trigger; }
  guard(): Expression | undefined { return this.#guard; }
  effect(): Expression | undefined { return this.#effect; }
  temporal(): TemporalExpressions | undefined { return this.#temporal === undefined ? undefined : { ...this.#temporal }; }

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
    if (!this.isEvent() || this.#trigger === undefined || this.#guard === undefined || this.#effect === undefined) return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }

  vacuityAntecedent(): Expression | undefined {
    return this.#assert?.op === "implies" ? this.#assert.args?.[0] : undefined;
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
