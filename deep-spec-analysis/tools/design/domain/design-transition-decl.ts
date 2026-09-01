import type { Expression, TriggerName } from "../../kernel/domain/index.ts";
import { BrRefs } from "./br-refs.ts";
import { type DesignTransitionId } from "./design-transition-id.ts";

export interface DesignTransitionDecl {
  readonly id: DesignTransitionId;
  readonly from?: string;
  readonly to?: string;
  readonly trigger?: TriggerName;
  readonly brRefs?: BrRefs;
  readonly guard?: Expression;
  readonly effect?: Expression;
}
