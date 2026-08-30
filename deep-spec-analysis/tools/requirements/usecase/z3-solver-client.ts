// z3 ソルバ実行ポート。check は計画（SMT-LIB 生成を含む）の構築と子プロセス
// 実行を実装に委ね、計画事実と型付き判定だけを返す。実行不能でも facts は
// 返る——コンパイル時 skip は unavailable 文書にも載るため。

import type { RequirementsModel, SmtPlanFacts, SmtQueryVerdicts } from "../domain/index.ts";

export type SmtSolverResult =
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: SmtQueryVerdicts };

export interface SmtCheck {
  readonly facts: SmtPlanFacts;
  readonly result: SmtSolverResult;
}

export interface Z3SolverClient {
  check(model: RequirementsModel): SmtCheck;
}
