import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { type DeclaredBindings, ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";
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

  diagnostics(catalog: IntermediateRepresentationAttributeCatalog): ErrorMessages {
    const context = `scenario ${this.#id.asString()}`;
    const errors: string[] = [];
    for (const message of catalog.bindingDiagnostics(this.#bindings, context)) errors.push(message.asString());
    if (this.#expect !== undefined)
      for (const message of catalog.expressionDiagnostics(this.#expect, context, this.#hasEvent))
        errors.push(message.asString());
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  id(): ScenarioIdentifier {
    return this.#id;
  }
}
