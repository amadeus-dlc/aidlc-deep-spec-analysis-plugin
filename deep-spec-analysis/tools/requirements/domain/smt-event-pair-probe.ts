import type { TriggerName } from "../../kernel/domain/index.ts";
import { type ObligationId } from "./obligation-id.ts";

export interface SmtEventPairProbe {
  readonly qOverlap: string;
  readonly qJoint: string;
  readonly a: ObligationId;
  readonly b: ObligationId;
  readonly trigger: TriggerName;
}
