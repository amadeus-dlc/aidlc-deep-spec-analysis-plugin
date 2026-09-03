// 設計シナリオ。accept/reject の意味、binding の正準列挙、BR/FR 帰属を所有する。

import type { Expression, FrRefs, TriggerName } from "@deep-spec/kernel-domain";
import { type BrRefs } from "./br-refs.ts";
import { DesignScenarioId } from "./design-scenario-id.ts";

export class DesignScenario {
  readonly #id: DesignScenarioId;
  readonly #kind: "accept" | "reject";
  readonly #brRefs: BrRefs;
  readonly #frRefs: FrRefs;
  readonly #bindings: Readonly<Record<string, boolean | number | string>>;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: {
    id: DesignScenarioId;
    kind: "accept" | "reject";
    brRefs: BrRefs;
    frRefs: FrRefs;
    bindings: Readonly<Record<string, boolean | number | string>>;
    event?: { readonly trigger: TriggerName };
    expect?: Expression;
  }) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#brRefs = props.brRefs;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect;
  }

  static reconstitute(props: {
    id: DesignScenarioId;
    kind: "accept" | "reject";
    brRefs: BrRefs;
    frRefs: FrRefs;
    bindings: Readonly<Record<string, boolean | number | string>>;
    event?: { readonly trigger: TriggerName };
    expect?: Expression;
  }): DesignScenario {
    return new DesignScenario(props);
  }

  id(): DesignScenarioId { return this.#id; }
  kind(): "accept" | "reject" { return this.#kind; }
  brRefs(): BrRefs { return this.#brRefs; }
  frRefs(): FrRefs { return this.#frRefs; }
  eventTrigger(): TriggerName | undefined { return this.#eventTrigger; }
  expectation(): Expression | undefined { return this.#expect; }
  isAccept(): boolean { return this.#kind === "accept"; }
  isReject(): boolean { return this.#kind === "reject"; }
  hasEvent(): boolean { return this.#eventTrigger !== undefined; }

  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return (this.isAccept() && !satisfiable) || (this.isReject() && satisfiable);
  }

  bindingEntriesCanonically(): readonly (readonly [string, boolean | number | string])[] {
    return Object.entries(this.#bindings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  bindings(): Readonly<Record<string, boolean | number | string>> { return { ...this.#bindings }; }
}
