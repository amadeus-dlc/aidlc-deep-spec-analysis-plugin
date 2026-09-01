import { type MachineSpec } from "./machine-spec.ts";
import { type StateNames } from "./state-names.ts";
import { type LineNumber } from "./line-number.ts";

// ---- functional-spec.md -----------------------------------------------------

export interface StateMachineSketchSeed {
  readonly spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
  readonly states: StateNames;
  readonly fenceLine: LineNumber;
  readonly unsupported: string | null; // 文言材料（理由のプローズ）
}
