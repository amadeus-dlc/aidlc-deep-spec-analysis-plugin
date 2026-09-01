import type { DesignValue } from "./design-value.ts";

// アダプタのパーサが素の v1 文書から選別した型付き判定面。
export interface SiblingVerdictFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: DesignValue;
  detail: string;
}
