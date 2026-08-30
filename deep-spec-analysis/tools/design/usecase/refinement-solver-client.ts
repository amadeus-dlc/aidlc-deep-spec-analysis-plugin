// refinement SMT 実行ポート。check はクエリ計画の構築（SMT-LIB 生成＝第 2
// コンパイラを含む）と v1 z3 子（--smt-child）の実行を実装に委ね、計画事実
// （Pending・コンパイル時 skip）と型付き判定だけを返す。クエリゼロは子を
// 起動しない（旧挙動の凍結——no-queries）。

import type {
  RefinementQueryVerdict,
  RefinementRequirements,
  RefinementSolverFacts,
  UnitRefinementPlan,
} from "../../refinement/domain/index.ts";
import type { DesignUnit } from "../domain/index.ts";

export type RefinementSolverResult =
  | { readonly kind: "no-queries" }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "solved"; readonly verdicts: ReadonlyMap<string, RefinementQueryVerdict> };

export interface RefinementCheck {
  readonly facts: RefinementSolverFacts;
  readonly result: RefinementSolverResult;
}

export interface RefinementSolverClient {
  check(unit: DesignUnit, requirements: RefinementRequirements, plan: UnitRefinementPlan, budgetMs: number): RefinementCheck;
}
