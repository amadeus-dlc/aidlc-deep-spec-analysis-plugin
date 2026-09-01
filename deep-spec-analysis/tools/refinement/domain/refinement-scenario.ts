import type { FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import type { ScenarioId } from "../../requirements/domain/index.ts";

export class RefinementScenario {
  readonly #id: ScenarioId;
  readonly #kind: "accept" | "reject";
  readonly #frRefs: FrRefs;
  readonly #bindings: Readonly<Record<string, boolean | number | string>>;
  readonly #eventTrigger: TriggerName | undefined;

  private constructor(props: { id: ScenarioId; kind: "accept" | "reject"; frRefs: FrRefs; bindings: Readonly<Record<string, boolean | number | string>>; event?: { readonly trigger: TriggerName } }) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#eventTrigger = props.event?.trigger;
  }

  static reconstitute(props: { id: ScenarioId; kind: "accept" | "reject"; frRefs: FrRefs; bindings: Readonly<Record<string, boolean | number | string>>; event?: { readonly trigger: TriggerName } }): RefinementScenario {
    return new RefinementScenario(props);
  }

  id(): ScenarioId { return this.#id; }
  kind(): "accept" | "reject" { return this.#kind; }
  frRefs(): FrRefs { return this.#frRefs; }
  eventTrigger(): TriggerName | undefined { return this.#eventTrigger; }
  isAccept(): boolean { return this.#kind === "accept"; }
  isReject(): boolean { return this.#kind === "reject"; }
  hasEvent(): boolean { return this.#eventTrigger !== undefined; }
  bindings(): Readonly<Record<string, boolean | number | string>> { return { ...this.#bindings }; }
  bindingEntriesCanonically(): readonly (readonly [string, boolean | number | string])[] {
    return Object.entries(this.#bindings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}
