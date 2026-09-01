import type { TriggerName } from "../../kernel/domain/index.ts";

export interface DesignIgnore {
  state: string;
  trigger: TriggerName;
  reason: string;
}
