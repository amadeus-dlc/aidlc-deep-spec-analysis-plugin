import type { ScenarioBindings } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression, FunctionalRequirementReferences, TriggerName } from "@deep-spec/kernel-domain";
// 設計シナリオ。accept/reject の意味、binding の正準列挙、BR/FR 帰属を所有する。

import { type BrRefs } from "./br-refs.ts";
import { DesignScenarioId } from "./design-scenario-id.ts";
import type { LoweredId } from "./lowered-id.ts";
import { LoweredScenario } from "./lowered-scenario.ts";

export class DesignScenario {
  readonly #id: DesignScenarioId;
  readonly #kind: "accept" | "reject";
  readonly #brRefs: BrRefs;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: Parameters<typeof DesignScenario.of>[0]) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#brRefs = props.brRefs;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static of(props: {
    id: DesignScenarioId;
    kind: "accept" | "reject";
    brRefs: BrRefs;
    functionalRequirementReferences: FunctionalRequirementReferences;
    bindings: ScenarioBindings;
    event?: { readonly trigger: TriggerName };
    expect?: Expression;
  }): DesignScenario {
    return new DesignScenario(props);
  }

  id(): DesignScenarioId { return this.#id; }
  kind(): "accept" | "reject" { return this.#kind; }
  brRefs(): BrRefs { return this.#brRefs; }
  functionalRequirementReferences(): FunctionalRequirementReferences { return this.#functionalRequirementReferences; }
  eventTrigger(): TriggerName | undefined { return this.#eventTrigger; }
  expectation(): Expression | undefined { return this.#expect; }
  isAccept(): boolean { return this.#kind === "accept"; }
  isReject(): boolean { return this.#kind === "reject"; }
  hasEvent(): boolean { return this.#eventTrigger !== undefined; }

  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return (this.isAccept() && !satisfiable) || (this.isReject() && satisfiable);
  }


  bindings(): ScenarioBindings { return this.#bindings; }

  // 契約1 への lowering——任意部（イベント・期待式）の有無はシナリオ自身の知識。
  loweredAs(id: LoweredId): LoweredScenario {
    return LoweredScenario.of({
      id,
      kind: this.#kind,
      functionalRequirementReferences: this.#functionalRequirementReferences,
      bindings: this.#bindings,
      ...(this.#eventTrigger !== undefined ? { event: { trigger: this.#eventTrigger.asString() } } : {}),
      ...(this.#expect !== undefined ? { expect: this.#expect } : {}),
    });
  }
}
