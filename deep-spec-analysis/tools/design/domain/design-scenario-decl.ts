import type { Expression } from "../../kernel/domain/index.ts";
import { BindingPairs } from "./binding-pairs.ts";
import { BrRefs } from "./br-refs.ts";
import { type DesignScenarioId } from "./design-scenario-id.ts";

export interface DesignScenarioDecl {
  readonly id: DesignScenarioId;
  readonly bindings: BindingPairs;
  readonly hasEvent: boolean;
  readonly expect?: Expression;
  readonly brRefs?: BrRefs;
}
