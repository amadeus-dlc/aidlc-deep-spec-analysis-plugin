import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import { BindingPairs } from "./binding-pairs.ts";
import { BrRefs } from "./br-refs.ts";
import { type DesignScenarioId } from "./design-scenario-id.ts";

export class DesignScenarioDecl {
  readonly #id: DesignScenarioId;
  readonly #bindings: BindingPairs;
  readonly #hasEvent: boolean;
  readonly #expect: Expression | undefined;
  readonly #brRefs: BrRefs | undefined;

  private constructor(props: { id: DesignScenarioId; bindings: BindingPairs; hasEvent: boolean; expect?: Expression; brRefs?: BrRefs }) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
    this.#brRefs = props.brRefs;
  }

  static reconstitute(props: { id: DesignScenarioId; bindings: BindingPairs; hasEvent: boolean; expect?: Expression; brRefs?: BrRefs }): DesignScenarioDecl {
    return new DesignScenarioDecl(props);
  }

  id(): DesignScenarioId { return this.#id; }
  bindings(): BindingPairs { return this.#bindings; }
  brRefs(): BrRefs | undefined { return this.#brRefs; }

  inspectExpectation(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#expect !== undefined) visitor(this.#expect, this.#hasEvent);
  }
}
