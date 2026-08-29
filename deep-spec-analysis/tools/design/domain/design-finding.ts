// 設計検証 finding / skip の語彙（契約2 拡張——unit 帰属つき）。witness は
// v1 判定から remap で受け継ぐ素通し値（core は remap 済みラベル列、trace /
// model / verdicts はそのまま）。

import type { DesignValue } from "./design-value.ts";

export interface DesignFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: DesignValue;
  unit: string;
  detail: string;
}

export interface DesignSkipped {
  target: string;
  reason: string;
  unit: string;
  detail?: string;
}
