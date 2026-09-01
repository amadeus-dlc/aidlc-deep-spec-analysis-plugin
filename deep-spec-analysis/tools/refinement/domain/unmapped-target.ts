import { UnmappedTargetRef } from "./unmapped-target-ref.ts";

export interface UnmappedTarget {
  readonly target: UnmappedTargetRef;
  readonly reason: string;
}
