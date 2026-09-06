import type {
  FunctionalRequirementReferences,
  ScenarioBindings,
  ScenarioExpectation,
  TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import type { ScenarioIdentifier } from "@deep-spec-analysis/requirements-domain";
import { AttributePaths } from "./attribute-paths.ts";
import { RefinementStatus } from "./refinement-status.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";
import { sameIterable, sameOptional } from "./value-equality.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementScenarioParam = {
  id: ScenarioIdentifier;
  expectation: ScenarioExpectation;
  functionalRequirementReferences: FunctionalRequirementReferences;
  bindings: ScenarioBindings;
  event?: { readonly trigger: TriggerName };
};

export class RefinementScenario {
  readonly #id: ScenarioIdentifier;
  readonly #expectation: ScenarioExpectation;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;

  private constructor(props: RefinementScenarioParam) {
    this.#id = props.id;
    this.#expectation = props.expectation;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
  }

  static of(props: RefinementScenarioParam): RefinementScenario {
    return new RefinementScenario(props);
  }

  equals(other: RefinementScenario): boolean {
    return (
      this.#id.equals(other.#id) &&
      this.#expectation.asString() === other.#expectation.asString() &&
      sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) =>
        left.equals(right),
      ) &&
      sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) &&
      sameOptional(this.#eventTrigger, other.#eventTrigger, (left, right) => left.equals(right))
    );
  }

  coverageIn(map: RefinementUnitMap): RefinementStatus {
    if (map.unmapped().covers(this.#id))
      return RefinementStatus.waived(map.unmapped().reasonOf(this.#id) ?? "listed in unmapped[]");
    if (this.hasEventRule()) return RefinementStatus.capability("event scenarios are not replayed in v1");
    return map
      .attrMap()
      .coverageOf(
        AttributePaths.of(this.#bindings.entriesCanonically().map((binding) => binding.path())),
        map.unmapped(),
      )
      .forScenario();
  }

  id(): ScenarioIdentifier {
    return this.#id;
  }
  kind(): "accept" | "reject" {
    return this.#expectation.asString();
  }
  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }
  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return this.#expectation.isViolatedBySatisfiability(satisfiable);
  }

  isAccept(): boolean {
    return this.#expectation.isAccept();
  }
  hasEventRule(): boolean {
    return this.#eventTrigger !== undefined;
  }
  bindings(): ScenarioBindings {
    return this.#bindings;
  }
}
