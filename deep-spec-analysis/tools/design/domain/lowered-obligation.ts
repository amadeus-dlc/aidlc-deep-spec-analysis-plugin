import type { Expression } from "../../kernel/domain/index.ts";
import { LoweredId } from "./lowered-id.ts";

export interface LoweredObligation {
  id: LoweredId;
  nature: string;
  frRefs: string[];
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
}
