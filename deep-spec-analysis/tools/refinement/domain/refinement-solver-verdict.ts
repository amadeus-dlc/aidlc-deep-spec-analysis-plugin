// refinement ソルバ実行の型付き判定と計画事実。SMT-LIB スクリプト・z3 の生
// 表現はアダプタ（第 2 コンパイラ＋クライアント）が持ち、ドメインへは
// クエリ id（"rv:OB-x" / "re:OB-x" / "rs2:OB-x:TR-y" / "rs:SC-x"）ごとの
// 判定と、その id が何の検査だったか（Pending）だけが届く。decoded モデルは
// pre / post（primed）の両状態。

import type { DesignSkipped } from "../../design/domain/index.ts";
import type { DesignValue } from "../../design/domain/index.ts";

export interface RefinementProbe {
  kind: "invariant" | "scenario" | "enabledness" | "simulation";
  reqId: string;
  designId?: string;
}

export type RefinementQueryStatus = "sat" | "unsat" | "unknown" | "budget" | "error";

export interface RefinementQueryVerdict {
  readonly status: RefinementQueryStatus;
  readonly decodedModel?: { [path: string]: DesignValue };
  readonly decodedPostModel?: { [path: string]: DesignValue };
  readonly core?: string[];
}

export interface RefinementSolverFacts {
  // クエリ発行順を保つ（timeout skip の記録順——最終文書は compose が正準ソート）。
  readonly pending: ReadonlyMap<string, RefinementProbe>;
  // alpha 置換・SMT コンパイルの失敗による compile-error skip（構築時に確定）。
  readonly compileSkips: readonly DesignSkipped[];
}
