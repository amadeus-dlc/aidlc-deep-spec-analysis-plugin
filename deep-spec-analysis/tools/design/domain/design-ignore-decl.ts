import type { TriggerName } from "../../kernel/domain/index.ts";

export interface DesignIgnoreDecl {
  readonly state: string;
  readonly trigger: TriggerName;
}
