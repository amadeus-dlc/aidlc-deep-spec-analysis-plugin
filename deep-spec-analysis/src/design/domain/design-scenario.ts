import type {
  Expression,
  FunctionalRequirementReferences,
  ScenarioBindings,
  TriggerName,
} from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// 設計シナリオ。accept/reject の意味、binding の正準列挙、BR/FR 帰属を所有する。

import type { BusinessRuleReferences } from "./business-rule-references.ts";
import type { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";
import { LoweredScenario } from "./lowered-scenario.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignScenarioParam = {
  id: DesignScenarioIdentifier;
  kind: "accept" | "reject";
  businessRuleReferences: BusinessRuleReferences;
  functionalRequirementReferences: FunctionalRequirementReferences;
  bindings: ScenarioBindings;
  event?: { readonly trigger: TriggerName };
  expect?: Expression;
};

export class DesignScenario {
  readonly #id: DesignScenarioIdentifier;
  readonly #kind: "accept" | "reject";
  readonly #businessRuleReferences: BusinessRuleReferences;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: DesignScenarioParam) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static parse(props: DesignScenarioParam): Result<DesignScenario, ParseError> {
    return parseConstruction(() => new DesignScenario(props));
  }

  static of(props: DesignScenarioParam): DesignScenario {
    return new DesignScenario(props);
  }

  id(): DesignScenarioIdentifier {
    return this.#id;
  }
  kind(): "accept" | "reject" {
    return this.#kind;
  }
  businessRuleReferences(): BusinessRuleReferences {
    return this.#businessRuleReferences;
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

  // 契約1 への lowering——任意部（イベント・期待式）の有無はシナリオ自身の知識。
  loweredAs(id: LoweredIdentifier): LoweredScenario {
    return LoweredScenario.of({
      id,
      kind: this.#kind,
      functionalRequirementReferences: this.#functionalRequirementReferences,
      bindings: this.#bindings,
      ...(this.#eventTrigger !== undefined ? { event: { trigger: this.#eventTrigger } } : {}),
      ...(this.#expect !== undefined ? { expect: this.#expect } : {}),
    });
  }
}
