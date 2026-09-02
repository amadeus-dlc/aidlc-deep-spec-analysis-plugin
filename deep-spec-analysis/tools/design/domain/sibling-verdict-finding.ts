import type { FrRefs } from "../../kernel/domain/index.ts";
import type { DesignValue } from "./design-value.ts";
import type { LoweredId } from "./lowered-id.ts";

// アダプタのパーサが素の v1 文書から選別した型付き判定面。targets は lowered
// 語彙の id（remap が設計語彙へ写す）。
export interface SiblingVerdictFinding {
  kind: string;
  frRefs: FrRefs;
  targets: readonly LoweredId[];
  witness: DesignValue;
  detail: string;
}
