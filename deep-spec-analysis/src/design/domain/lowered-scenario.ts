import type { ScenarioBindings } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferences } from "@deep-spec/kernel-domain";

import type { LoweredId } from "./lowered-id.ts";

// lowered v1 シナリオ。accept / reject の区別と任意部（イベント・期待式）の
// 有無はシナリオ自身の知識（#71 波20）。
export class LoweredScenario {
  readonly #id: LoweredId;
  readonly #kind: "accept" | "reject";
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #event: { readonly trigger: string } | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: Parameters<typeof LoweredScenario.of>[0]) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#event = props.event;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static of(props: { id: LoweredId; kind: "accept" | "reject"; functionalRequirementReferences: FunctionalRequirementReferences; bindings: ScenarioBindings; event?: { readonly trigger: string }; expect?: Expression }): LoweredScenario {
    return new LoweredScenario(props);
  }

  id(): LoweredId {
    return this.#id;
  }

  kind(): "accept" | "reject" {
    return this.#kind;
  }

  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }

  bindings(): ScenarioBindings {
    return this.#bindings;
  }

  event(): { readonly trigger: string } | undefined {
    return this.#event;
  }

  expectation(): Expression | undefined {
    return this.#expect;
  }

  isAccept(): boolean {
    return this.#kind === "accept";
  }
}
