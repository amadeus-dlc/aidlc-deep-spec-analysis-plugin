import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

import { IrBindingPairs } from "./ir-binding-pairs.ts";
import { type ScenarioId } from "./scenario-id.ts";

export class IrScenarioDecl {
  readonly #id: ScenarioId;
  readonly #bindings: IrBindingPairs;
  readonly #hasEvent: boolean;
  readonly #expect: Expression | undefined;

  private constructor(props: Parameters<typeof IrScenarioDecl.of>[0]) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static of(props: { id: ScenarioId; bindings: IrBindingPairs; hasEvent: boolean; expect?: Expression }): IrScenarioDecl {
    return new IrScenarioDecl(props);
  }

  id(): ScenarioId { return this.#id; }
  bindings(): IrBindingPairs { return this.#bindings; }

  inspectExpectation(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#expect !== undefined) visitor(this.#expect, this.#hasEvent);
  }
}
