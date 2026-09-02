import type { TargetId } from "../../kernel/domain/index.ts";

export interface DesignSkipped {
  target: TargetId;
  reason: string;
  unit: string;
  detail?: string;
}
