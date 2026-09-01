import type { Expression } from "../../kernel/domain/index.ts";
import type { DesignObligation } from "./design-obligation.ts";
import { LoweredId } from "./lowered-id.ts";

export interface LoweredObligation {
  id: LoweredId;
  nature: string;
  frRefs: string[];
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: DesignObligation["temporal"];
}
