import type { SolverAvailability } from "@deep-spec/doctor-domain";

// ソルバ環境プローブのポート。実装は adapter（spawnSync --version 打診と
// パッケージ/配布物の実在検査）。
export interface SolverProbeClient {
  availability(): SolverAvailability;
}
