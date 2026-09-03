import { ExpressionTree, type Expression, type TriggerName } from "@deep-spec/kernel-domain";
import { BrRefs } from "./br-refs.ts";
import { type DesignTransitionId } from "./design-transition-id.ts";

export class DesignTransitionDecl {
  readonly #id: DesignTransitionId;
  readonly #from: string | undefined;
  readonly #to: string | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #brRefs: BrRefs | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;

  private constructor(props: { id: DesignTransitionId; from?: string; to?: string; trigger?: TriggerName; brRefs?: BrRefs; guard?: Expression; effect?: Expression }) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#brRefs = props.brRefs;
    this.#guard = props.guard;
    this.#effect = props.effect;
  }

  static reconstitute(props: { id: DesignTransitionId; from?: string; to?: string; trigger?: TriggerName; brRefs?: BrRefs; guard?: Expression; effect?: Expression }): DesignTransitionDecl {
    return new DesignTransitionDecl(props);
  }

  id(): DesignTransitionId { return this.#id; }
  fromState(): string | undefined { return this.#from; }
  toState(): string | undefined { return this.#to; }
  trigger(): TriggerName | undefined { return this.#trigger; }
  brRefs(): BrRefs | undefined { return this.#brRefs; }
  guard(): Expression | undefined { return this.#guard; }
  effect(): Expression | undefined { return this.#effect; }

  stateEntries(): readonly (readonly ["from" | "to", string | undefined])[] {
    return [["from", this.#from], ["to", this.#to]];
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
