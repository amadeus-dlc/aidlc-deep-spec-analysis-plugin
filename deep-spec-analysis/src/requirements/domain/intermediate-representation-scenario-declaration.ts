import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { type DeclaredBindings, ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import {
  canonicalStringify,
  combinedHash,
  hashOfBoolean,
  hashOfNullable,
  hashOfString,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
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
    return ErrorMessages.collect(this.diagnosticStrings(catalog).map(ErrorMessage.parse));
  }

  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(catalog: IntermediateRepresentationAttributeCatalog): string[] {
    const context = `scenario ${this.#id.asString()}`;
    const errors: string[] = [...catalog.bindingDiagnosticStrings(this.#bindings, context)];
    const expectation = this.#expect;
    if (expectation !== undefined)
      errors.push(...catalog.expressionDiagnosticStrings(expectation, context, this.#hasEvent));
    return errors;
  }

  id(): ScenarioIdentifier {
    return this.#id;
  }

  equals(other: IntermediateRepresentationScenarioDeclaration): boolean {
    const expressionEqual =
      this.#expect === undefined
        ? other.#expect === undefined
        : other.#expect !== undefined &&
          ExpressionTree.of(this.#expect).isCanonicallyEqual(ExpressionTree.of(other.#expect));
    return (
      this.#id.equals(other.#id) &&
      this.#hasEvent === other.#hasEvent &&
      this.#bindings.matchesVerbatim(other.#bindings) &&
      expressionEqual
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#id.hashCode(),
      hashOfBoolean(this.#hasEvent),
      this.#bindings.verbatimHashCode(),
      hashOfNullable(this.#expect, (expr) => hashOfString(canonicalStringify(expr))),
    ]);
  }
}
