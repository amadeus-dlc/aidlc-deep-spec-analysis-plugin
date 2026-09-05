import type { Expression } from "@deep-spec/kernel-domain";
import { type DeclaredBindings, ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import type { BusinessRuleReferences } from "./business-rule-references.ts";
import type { DesignScenarioIdentifier } from "./design-scenario-identifier.ts";

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

  id(): DesignScenarioIdentifier {
    return this.#id;
  }
  bindings(): DeclaredBindings {
    return this.#bindings;
  }
  businessRuleReferences(): BusinessRuleReferences | undefined {
    return this.#businessRuleReferences;
  }

  inspectExpectation(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#expect !== undefined) visitor(this.#expect, this.#hasEvent);
  }
}
