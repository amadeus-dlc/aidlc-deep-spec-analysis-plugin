import { type LoweredId } from "./lowered-id.ts";

export interface SiblingVerdictSkip {
  target: LoweredId;
  reason: string;
  detail?: string;
}
