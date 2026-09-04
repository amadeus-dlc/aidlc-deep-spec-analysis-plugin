// refinement SMT 実行ポート。check はクエリ計画の構築（SMT-LIB 生成＝第 2
// コンパイラを含む）と v1 z3 子（--smt-child）の実行を実装に委ね、計画
// （Pending・コンパイル時 skip）と型付き判定だけを返す。クエリゼロは子を
// 起動しない（旧挙動の凍結——no-queries）。

import type { RefinementRequirements, UnitRefinementPlan } from "@deep-spec/design-domain";
import type { DesignUnit } from "@deep-spec/design-domain";
import type { RefinementCheck } from "./refinement-check.ts";

export interface RefinementSolverClient {
  check(unit: DesignUnit, requirements: RefinementRequirements, plan: UnitRefinementPlan, budgetMs: number): RefinementCheck;
}
