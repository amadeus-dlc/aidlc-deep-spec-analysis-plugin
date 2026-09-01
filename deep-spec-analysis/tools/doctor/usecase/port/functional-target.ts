import type { FunctionalUnitFacts } from "./functional-unit-facts.ts";

// 設計検証カバレッジの走査材料 1 件——スコープ適格で functional-design を持つ
// unit が 1 つ以上ある intent。モデルの units[] 台帳・backend 文書の checked[]
// 由来の完了 unit・refinement 失効の mtime 材料を運ぶ。
export interface FunctionalTarget {
  space: string;
  intent: string;
  units: readonly FunctionalUnitFacts[];
  modelMtime: number;
  modelUnits: readonly string[];
  completedUnits: readonly string[];
  hasFindings: boolean;
  requirementsModelMtime: number | null;
}
