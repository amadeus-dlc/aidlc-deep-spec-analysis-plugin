import type { ScenarioBindings } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferences, TriggerName } from "@deep-spec/kernel-domain";
// 受け入れ／拒否シナリオ。期待する充足可能性と binding の正準列挙を所有する。

import { ScenarioId } from "./scenario-id.ts";

export class Scenario {
  readonly #id: ScenarioId;
  readonly #kind: "accept" | "reject";
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: Parameters<typeof Scenario.of>[0]) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static of(props: {
    id: ScenarioId;
    kind: "accept" | "reject";
    functionalRequirementReferences: FunctionalRequirementReferences;
    bindings: ScenarioBindings;
    event?: { readonly trigger: TriggerName };
    expect?: Expression;
  }): Scenario {
    return new Scenario(props);
  }

  id(): ScenarioId { return this.#id; }
  kind(): "accept" | "reject" { return this.#kind; }
  functionalRequirementReferences(): FunctionalRequirementReferences { return this.#functionalRequirementReferences; }
  eventTrigger(): TriggerName | undefined { return this.#eventTrigger; }
  expectation(): Expression | undefined { return this.#expect; }
  isAccept(): boolean { return this.#kind === "accept"; }
  isReject(): boolean { return this.#kind === "reject"; }
  hasEvent(): boolean { return this.#eventTrigger !== undefined; }

  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return (this.isAccept() && !satisfiable) || (this.isReject() && satisfiable);
  }


  bindings(): ScenarioBindings {
    return this.#bindings;
  }
}
