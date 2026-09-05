import type {
  Expression,
  FunctionalRequirementReferences,
  ScenarioBindings,
  TriggerName,
} from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// 受け入れ／拒否シナリオ。期待する充足可能性と binding の正準列挙を所有する。

import type { ScenarioIdentifier } from "./scenario-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ScenarioParam = {
  id: ScenarioIdentifier;
  kind: "accept" | "reject";
  functionalRequirementReferences: FunctionalRequirementReferences;
  bindings: ScenarioBindings;
  event?: { readonly trigger: TriggerName };
  expect?: Expression;
};

export class Scenario {
  readonly #id: ScenarioIdentifier;
  readonly #kind: "accept" | "reject";
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: ScenarioParam) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static parse(props: ScenarioParam): Result<Scenario, ParseError> {
    return parseConstruction(() => new Scenario(props));
  }

  static of(props: ScenarioParam): Scenario {
    return new Scenario(props);
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
  expectation(): Expression | undefined {
    return this.#expect;
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

  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return (this.isAccept() && !satisfiable) || (this.isReject() && satisfiable);
  }

  bindings(): ScenarioBindings {
    return this.#bindings;
  }
}
