import type { Expression } from "../../kernel/domain/index.ts";
import { IrBindingPairs } from "./ir-binding-pairs.ts";
import { type ScenarioId } from "./scenario-id.ts";

export interface IrScenarioDecl {
  readonly id: ScenarioId;
  readonly bindings: IrBindingPairs;
  readonly hasEvent: boolean;
  readonly expect?: Expression;
}
