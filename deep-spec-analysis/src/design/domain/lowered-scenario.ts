import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import type { ScenarioBindings } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression, TriggerName } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferences } from "@deep-spec/kernel-domain";

import type { LoweredIdentifier } from "./lowered-identifier.ts";

// lowered v1 シナリオ。accept / reject の区別と任意部（イベント・期待式）の
// 有無はシナリオ自身の知識（#71 波20）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredScenarioParam = { id: LoweredIdentifier; kind: "accept" | "reject"; functionalRequirementReferences: FunctionalRequirementReferences; bindings: ScenarioBindings; event?: { readonly trigger: TriggerName }; expect?: Expression };

export class LoweredScenario {
  readonly #id: LoweredIdentifier;
  readonly #kind: "accept" | "reject";
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: LoweredScenarioParam) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static parse(props: LoweredScenarioParam): Result<LoweredScenario, ParseError> {
    return parseConstruction(() => new LoweredScenario(props));
  }

  static of(props: LoweredScenarioParam): LoweredScenario {
    return new LoweredScenario(props);
  }

  id(): LoweredIdentifier {
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
    return this.#eventTrigger === undefined ? undefined : { trigger: this.#eventTrigger.asString() };
  }

  expectation(): Expression | undefined {
    return this.#expect;
  }

  isAccept(): boolean {
    return this.#kind === "accept";
  }
}
