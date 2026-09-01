import { LoweredOriginRef } from "./lowered-origin-ref.ts";
import type { LoweringKind } from "./lowering-kind.ts";

export interface LoweredOrigin {
  design: LoweredOriginRef;
  kind: LoweringKind;
  pair?: [LoweredOriginRef, LoweredOriginRef];
}
