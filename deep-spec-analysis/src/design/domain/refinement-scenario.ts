import type { FunctionalRequirementReferences, ScenarioBindings, TriggerName } from "@deep-spec/kernel-domain";
import type { ScenarioIdentifier } from "@deep-spec/requirements-domain";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementScenarioParam = {
  id: ScenarioIdentifier;
  kind: "accept" | "reject";
  functionalRequirementReferences: FunctionalRequirementReferences;
  bindings: ScenarioBindings;
  event?: { readonly trigger: TriggerName };
};

export class RefinementScenario {
  readonly #id: ScenarioIdentifier;
  readonly #kind: "accept" | "reject";
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;

  private constructor(props: RefinementScenarioParam) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
  }

  static of(props: RefinementScenarioParam): RefinementScenario {
    return new RefinementScenario(props);
  }

  id(): ScenarioIdentifier {
    return this.#id;
  }
  kind(): "accept" | "reject" {
    return this.#kind;
  }
  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }
  eventTrigger(): TriggerName | undefined {
    return this.#eventTrigger;
  }
  isAccept(): boolean {
    return this.#kind === "accept";
  }
  isReject(): boolean {
    return this.#kind === "reject";
  }
  hasEvent(): boolean {
    return this.#eventTrigger !== undefined;
  }
  bindings(): ScenarioBindings {
    return this.#bindings;
  }
}
