import type { ScenarioBindings } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferences, TriggerName } from "@deep-spec/kernel-domain";
import type { ScenarioId } from "@deep-spec/requirements-domain";

export class RefinementScenario {
  readonly #id: ScenarioId;
  readonly #kind: "accept" | "reject";
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;

  private constructor(props: Parameters<typeof RefinementScenario.of>[0]) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
  }

  static of(props: { id: ScenarioId; kind: "accept" | "reject"; functionalRequirementReferences: FunctionalRequirementReferences; bindings: ScenarioBindings; event?: { readonly trigger: TriggerName } }): RefinementScenario {
    return new RefinementScenario(props);
  }

  id(): ScenarioId { return this.#id; }
  kind(): "accept" | "reject" { return this.#kind; }
  functionalRequirementReferences(): FunctionalRequirementReferences { return this.#functionalRequirementReferences; }
  eventTrigger(): TriggerName | undefined { return this.#eventTrigger; }
  isAccept(): boolean { return this.#kind === "accept"; }
  isReject(): boolean { return this.#kind === "reject"; }
  hasEvent(): boolean { return this.#eventTrigger !== undefined; }
  bindings(): ScenarioBindings { return this.#bindings; }
}
