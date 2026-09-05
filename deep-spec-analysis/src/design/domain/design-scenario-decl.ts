import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

import { DeclaredBindings } from "@deep-spec/kernel-domain";
import { BrRefs } from "./br-refs.ts";
import { type DesignScenarioId } from "./design-scenario-id.ts";

export class DesignScenarioDecl {
  readonly #id: DesignScenarioId;
  readonly #bindings: DeclaredBindings;
  readonly #hasEvent: boolean;
  readonly #expect: Expression | undefined;
  readonly #brRefs: BrRefs | undefined;

  private constructor(props: Parameters<typeof DesignScenarioDecl.of>[0]) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
    this.#brRefs = props.brRefs;
  }

  static of(props: { id: DesignScenarioId; bindings: DeclaredBindings; hasEvent: boolean; expect?: Expression; brRefs?: BrRefs }): DesignScenarioDecl {
    return new DesignScenarioDecl(props);
  }

  id(): DesignScenarioId { return this.#id; }
  bindings(): DeclaredBindings { return this.#bindings; }
  brRefs(): BrRefs | undefined { return this.#brRefs; }

  inspectExpectation(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#expect !== undefined) visitor(this.#expect, this.#hasEvent);
  }
}
