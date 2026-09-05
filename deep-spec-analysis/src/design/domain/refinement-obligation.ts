import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression, FrRefs, TriggerName } from "@deep-spec/kernel-domain";
import type { ObligationId, ObligationNature } from "@deep-spec/requirements-domain";

export class RefinementObligation {
  readonly #id: ObligationId;
  readonly #nature: ObligationNature;
  readonly #frRefs: FrRefs;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;

  private constructor(props: { id: ObligationId; nature: ObligationNature; frRefs: FrRefs; assert?: Expression; trigger?: TriggerName; guard?: Expression; effect?: Expression }) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#frRefs = props.frRefs;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
  }

  static reconstitute(props: { id: ObligationId; nature: ObligationNature; frRefs: FrRefs; assert?: Expression; trigger?: TriggerName; guard?: Expression; effect?: Expression }): RefinementObligation {
    return new RefinementObligation(props);
  }

  id(): ObligationId { return this.#id; }
  nature(): ObligationNature { return this.#nature; }
  frRefs(): FrRefs { return this.#frRefs; }
  assertion(): Expression | undefined { return this.#assert; }
  trigger(): TriggerName | undefined { return this.#trigger; }
  guard(): Expression | undefined { return this.#guard; }
  effect(): Expression | undefined { return this.#effect; }
  isInvariantLike(): boolean { return this.#nature.isInvariant() || this.#nature.isNumeric(); }
  isEvent(): boolean { return this.#nature.isEvent(); }
  isStateTemporal(): boolean { return this.#nature.isStateTemporal(); }

  eventDefinition(): { readonly trigger: TriggerName; readonly guard: Expression; readonly effect: Expression } | null {
    if (!this.#nature.isEvent() || this.#trigger === undefined || this.#trigger.isEmpty() || this.#guard === undefined || this.#effect === undefined) return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }
}
