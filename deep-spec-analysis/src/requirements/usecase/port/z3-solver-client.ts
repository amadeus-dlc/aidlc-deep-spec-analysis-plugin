// z3 ソルバ実行ポート。check は計画（SMT-LIB 生成を含む）の構築と子プロセス
// 実行を実装に委ねる。返す結果は実行不能時も計画時skipを保持し、unavailable文書を形成する。

import type { RequirementsModel, SatisfiabilityModuloTheoriesCheck } from "@deep-spec/requirements-domain";

export interface Z3SolverClient {
  check(model: RequirementsModel): SatisfiabilityModuloTheoriesCheck;
}
