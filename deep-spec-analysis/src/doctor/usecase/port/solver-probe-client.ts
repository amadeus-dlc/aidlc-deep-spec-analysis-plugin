import type { SolverAvailability } from "@deep-spec-analysis/doctor-domain";
import type { Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

// ソルバ環境プローブのポート。実装は adapter（spawnSync --version 打診と
// パッケージ/配布物の実在検査）。
export interface SolverProbeClient {
  availability(): Result<SolverAvailability, RepositoryError>;
}
