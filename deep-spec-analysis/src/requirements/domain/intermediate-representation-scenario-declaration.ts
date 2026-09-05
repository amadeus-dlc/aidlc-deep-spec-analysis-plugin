import type { Expression } from "@deep-spec/kernel-domain";
import { type DeclaredBindings, ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import type { ScenarioIdentifier } from "./scenario-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationScenarioDeclarationParam = {
  id: ScenarioIdentifier;
  bindings: DeclaredBindings;
  hasEvent: boolean;
  expect?: Expression;
};

export class IntermediateRepresentationScenarioDeclaration {
  readonly #id: ScenarioIdentifier;
  readonly #bindings: DeclaredBindings;
  readonly #hasEvent: boolean;
  readonly #expect: Expression | undefined;

  private constructor(props: IntermediateRepresentationScenarioDeclarationParam) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static parse(
    props: IntermediateRepresentationScenarioDeclarationParam,
  ): Result<IntermediateRepresentationScenarioDeclaration, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationScenarioDeclaration(props));
  }

  static of(props: IntermediateRepresentationScenarioDeclarationParam): IntermediateRepresentationScenarioDeclaration {
    return new IntermediateRepresentationScenarioDeclaration(props);
  }

  id(): ScenarioIdentifier {
    return this.#id;
  }
  bindings(): DeclaredBindings {
    return this.#bindings;
  }

  inspectExpectation(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#expect !== undefined) visitor(this.#expect, this.#hasEvent);
  }
}
