import type { TriggerName } from "../../kernel/domain/index.ts";
import { TransitionRefs } from "./transition-refs.ts";

export interface EventMapping {
  readonly reqTrigger: TriggerName;
  readonly transitions: TransitionRefs;
  readonly waived?: { readonly reason: string };
}
