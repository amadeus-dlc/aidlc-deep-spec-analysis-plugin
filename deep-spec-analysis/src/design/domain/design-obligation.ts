// 設計義務。分類、rules 起源の参照要件、event 完全性、式の役割を所有する。

import type { Expression, FrRefs, TriggerName } from "@deep-spec/kernel-domain";
import { type BrRefs } from "./br-refs.ts";
import { DesignObligationId } from "./design-obligation-id.ts";
import { DesignObligationNature } from "./design-obligation-nature.ts";
import { DesignObligationOrigin } from "./design-obligation-origin.ts";

type DesignTemporalExpressions = {
  readonly pattern: string;
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
};

export class DesignObligation {
  readonly #id: DesignObligationId;
  readonly #nature: DesignObligationNature;
  readonly #origin: DesignObligationOrigin;
  readonly #brRefs: BrRefs;
  readonly #frRefs: FrRefs;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: DesignTemporalExpressions | undefined;

  private constructor(props: {
    id: DesignObligationId;
    nature: DesignObligationNature;
    origin: DesignObligationOrigin;
    brRefs: BrRefs;
    frRefs: FrRefs;
    assert?: Expression;
    trigger?: TriggerName;
    guard?: Expression;
    effect?: Expression;
    temporal?: DesignTemporalExpressions;
  }) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#origin = props.origin;
    this.#brRefs = props.brRefs;
    this.#frRefs = props.frRefs;
    this.#assert = props.assert;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal === undefined ? undefined : { ...props.temporal };
  }

  static reconstitute(props: {
    id: DesignObligationId;
    nature: DesignObligationNature;
    origin: DesignObligationOrigin;
    brRefs: BrRefs;
    frRefs: FrRefs;
    assert?: Expression;
    trigger?: TriggerName;
    guard?: Expression;
    effect?: Expression;
    temporal?: DesignTemporalExpressions;
  }): DesignObligation {
    return new DesignObligation(props);
  }

  id(): DesignObligationId { return this.#id; }
  nature(): DesignObligationNature { return this.#nature; }
  origin(): DesignObligationOrigin { return this.#origin; }
  brRefs(): BrRefs { return this.#brRefs; }
  frRefs(): FrRefs { return this.#frRefs; }
  assertion(): Expression | undefined { return this.#assert; }
  trigger(): TriggerName | undefined { return this.#trigger; }
  guard(): Expression | undefined { return this.#guard; }
  effect(): Expression | undefined { return this.#effect; }
  temporal(): DesignTemporalExpressions | undefined { return this.#temporal === undefined ? undefined : { ...this.#temporal }; }
  isInvariantLike(): boolean { return this.#nature.isInvariant() || this.#nature.isNumeric(); }
  isEvent(): boolean { return this.#nature.isEvent(); }

  guardedEffect(): { readonly guard: Expression; readonly effect: Expression } | null {
    if (!this.isEvent() || this.#guard === undefined || this.#effect === undefined) return null;
    return { guard: this.#guard, effect: this.#effect };
  }

  eventDefinition(): { readonly trigger: TriggerName; readonly guard: Expression; readonly effect: Expression } | null {
    const behavior = this.guardedEffect();
    if (behavior === null || this.#trigger === undefined || this.#trigger.isEmpty()) return null;
    return { trigger: this.#trigger, ...behavior };
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
