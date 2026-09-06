import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { type DeclaredBindings, ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { BusinessRuleReferences } from "./business-rule-references.ts";
import type { DesignAttributeCatalog } from "./design-attribute-catalog.ts";
import type { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";
import { sameExpression, sameIterable, sameOptional } from "./value-equality.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignScenarioDeclarationParam = {
  id: DesignScenarioIdentifier;
  bindings: DeclaredBindings;
  hasEvent: boolean;
  expect?: Expression;
  businessRuleReferences?: BusinessRuleReferences;
};

export class DesignScenarioDeclaration {
  readonly #id: DesignScenarioIdentifier;
  readonly #bindings: DeclaredBindings;
  readonly #hasEvent: boolean;
  readonly #expect: Expression | undefined;
  readonly #businessRuleReferences: BusinessRuleReferences | undefined;

  private constructor(props: DesignScenarioDeclarationParam) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
    this.#businessRuleReferences = props.businessRuleReferences;
  }

  static parse(props: DesignScenarioDeclarationParam): Result<DesignScenarioDeclaration, ParseError> {
    return parseConstruction(() => new DesignScenarioDeclaration(props));
  }

  static of(props: DesignScenarioDeclarationParam): DesignScenarioDeclaration {
    return new DesignScenarioDeclaration(props);
  }

  equals(other: DesignScenarioDeclaration): boolean {
    return (
      this.#id.equals(other.#id) &&
      this.#hasEvent === other.#hasEvent &&
      sameExpression(this.#expect, other.#expect) &&
      sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) &&
      sameOptional(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) =>
        sameIterable(left, right, (a, b) => a.equals(b)),
      )
    );
  }

  diagnostics(catalog: DesignAttributeCatalog): ErrorMessages {
    const context = `scenario ${this.#id.asString()}`;
    const errors: string[] = [];
    for (const message of catalog.bindingDiagnostics(this.#bindings, context)) errors.push(message.asString());
    if (this.#expect !== undefined)
      for (const message of catalog.expressionDiagnostics(this.#expect, context, this.#hasEvent))
        errors.push(message.asString());
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  id(): DesignScenarioIdentifier {
    return this.#id;
  }

  businessRuleReferences(): BusinessRuleReferences | undefined {
    return this.#businessRuleReferences;
  }
}
