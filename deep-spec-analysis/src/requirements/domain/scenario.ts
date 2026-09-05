import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { FrRefs, TriggerName } from "@deep-spec/kernel-domain";
// 受け入れ／拒否シナリオ。期待する充足可能性と binding の正準列挙を所有する。

import { ScenarioId } from "./scenario-id.ts";

export class Scenario {
  readonly #id: ScenarioId;
  readonly #kind: "accept" | "reject";
  readonly #frRefs: FrRefs;
  readonly #bindings: Readonly<Record<string, boolean | number | string>>;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: Parameters<typeof Scenario.of>[0]) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static of(props: {
    id: ScenarioId;
    kind: "accept" | "reject";
    frRefs: FrRefs;
    bindings: Readonly<Record<string, boolean | number | string>>;
    event?: { readonly trigger: TriggerName };
    expect?: Expression;
  }): Scenario {
    return new Scenario(props);
  }

  id(): ScenarioId { return this.#id; }
  kind(): "accept" | "reject" { return this.#kind; }
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

  bindings(): Readonly<Record<string, boolean | number | string>> {
    return { ...this.#bindings };
  }
}
