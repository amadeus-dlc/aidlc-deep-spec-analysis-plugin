import {
  type Expression,
  ExpressionTree,
  type FunctionalRequirementReferences,
  type ScenarioBindings,
  type ScenarioExpectation,
  type TriggerName,
} from "@deep-spec-analysis/kernel-domain";

import {
  canonicalStringify,
  combinedHash,
  hashOfNullable,
  hashOfString,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";

import type { LoweredIdentifier } from "./lowered-identifier.ts";
import { sameExpression, sameIterable, sameOptional } from "./value-equality.ts";

// lowered v1 シナリオ。accept / reject の区別と任意部（イベント・期待式）の
// 有無はシナリオ自身の知識（#71 波20）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredScenarioParam = {
  id: LoweredIdentifier;
  origin: DesignScenarioIdentifier;
  expectation: ScenarioExpectation;
  functionalRequirementReferences: FunctionalRequirementReferences;
  bindings: ScenarioBindings;
  event?: { readonly trigger: TriggerName };
  expect?: Expression;
};

export class LoweredScenario {
  readonly #id: LoweredIdentifier;
  readonly #origin: DesignScenarioIdentifier;
  readonly #expectation: ScenarioExpectation;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: LoweredScenarioParam) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#expectation = props.expectation;
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

  equals(other: LoweredScenario): boolean {
    return (
      this.#id.equals(other.#id) &&
      this.#origin.equals(other.#origin) &&
      this.#expectation.asString() === other.#expectation.asString() &&
      sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) =>
        left.equals(right),
      ) &&
      sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) &&
      sameOptional(this.#eventTrigger, other.#eventTrigger, (left, right) => left.equals(right)) &&
      sameExpression(this.#expect, other.#expect)
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#id.hashCode(),
      this.#origin.hashCode(),
      hashOfString(this.#expectation.asString()),
      this.#functionalRequirementReferences.hashCode(),
      this.#bindings.hashCode(),
      hashOfNullable(this.#eventTrigger, (value) => value.hashCode()),
      hashOfNullable(this.#expect, (value) => hashOfString(canonicalStringify(value))),
    ]);
  }

  origin(): DesignScenarioIdentifier {
    return this.#origin;
  }

  id(): LoweredIdentifier {
    return this.#id;
  }

  kind(): "accept" | "reject" {
    return this.#expectation.asString();
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

  expectedExpression(): Expression | undefined {
    return this.#expect;
  }

  isAccept(): boolean {
    return this.#expectation.isAccept();
  }
}
