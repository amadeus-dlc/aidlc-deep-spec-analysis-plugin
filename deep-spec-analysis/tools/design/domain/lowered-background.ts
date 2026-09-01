import type { Expression } from "../../kernel/domain/index.ts";
import { LoweredId } from "./lowered-id.ts";

export interface LoweredBackground {
  id: LoweredId;
  assert: Expression;
}
