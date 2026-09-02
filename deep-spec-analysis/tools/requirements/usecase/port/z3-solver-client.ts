// z3 ソルバ実行ポート。check は計画（SMT-LIB 生成を含む）の構築と子プロセス
// 実行を実装に委ね、計画と型付き判定だけを返す。実行不能でも plan は
// 返る——コンパイル時 skip は unavailable 文書にも載るため。

import type { RequirementsModel } from "../../domain/index.ts";
import type { SmtCheck } from "./smt-check.ts";

export interface Z3SolverClient {
  check(model: RequirementsModel): SmtCheck;
}
