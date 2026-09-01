import type { CoverageState } from "./coverage-state.ts";

// 要件検証カバレッジの問題 1 行（文言材料——presenter が凍結文言に描画）。
export interface CoverageRow {
  space: string;
  intent: string;
  state: CoverageState;
}
