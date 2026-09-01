import type { CoverageState } from "./coverage-state.ts";

// 設計検証カバレッジの問題 1 行（unit 粒度）。
export interface UnitCoverageRow {
  space: string;
  intent: string;
  unit: string;
  state: CoverageState;
}
