import type { TargetId } from "../../kernel/domain/index.ts";

export interface VerificationSkipped {
  target: TargetId;
  reason: string;
  detail?: string;
}
