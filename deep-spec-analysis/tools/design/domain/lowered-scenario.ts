import type { Expression } from "../../kernel/domain/index.ts";
import { LoweredId } from "./lowered-id.ts";

export interface LoweredScenario {
  id: LoweredId;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}
