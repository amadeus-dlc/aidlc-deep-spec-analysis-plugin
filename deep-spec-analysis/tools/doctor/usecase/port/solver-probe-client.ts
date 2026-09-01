import type { SolverAvailability } from "../../domain/index.ts";

// ソルバ環境プローブのポート。実装は adapter（spawnSync --version 打診と
// パッケージ/配布物の実在検査）。
export interface SolverProbeClient {
  availability(): SolverAvailability;
}
