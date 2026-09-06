import { type KeyedIndex, type QueryLabel, UnitName } from "@deep-spec-analysis/kernel-domain";

// refinement ソルバ実行の型付き判定と計画（対応表）。SMT-LIB スクリプト・z3 の生
// 表現はアダプタ（第 2 コンパイラ＋クライアント）が持ち、ドメインへは
// クエリ id（"rv:OB-x" / "re:OB-x" / "rs2:OB-x:TR-y" / "rs:SC-x"）ごとの
// 判定と、その id が何の検査だったか（Pending）だけが届く。decoded モデルは
// pre / post（primed）の両状態。判定の解釈（4 種の検査 → findings / skips、
// detail 文言は golden 凍結）は plan 自身の振る舞い（OOUI 裁定——旧
// interpretRefinementVerdicts の逐語移植）。

import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { RefinementProbe } from "./refinement-probe.ts";
import type { RefinementQueryVerdicts } from "./refinement-query-verdicts.ts";
import type { UnitRefinementPlan } from "./unit-refinement-plan.ts";

// クエリ計画（値オブジェクト、裁定 8——旧 RefinementSolverFacts）：発行順の Pending 索引と、alpha 置換・SMT コンパイル失敗
// による compile-error skip（構築時に確定）。
type RefinementSolverPlanParam = {
  preparation: UnitRefinementPlan;
  pending: KeyedIndex<QueryLabel, RefinementProbe>;
  compileSkips: DesignSkips;
};

export class RefinementSolverPlan {
  readonly #preparation: UnitRefinementPlan;
  readonly #pending: KeyedIndex<QueryLabel, RefinementProbe>;
  readonly #compileSkips: DesignSkips;

  /** 1ユニットのソルバ計画は65,536問・65,536診断まで。元の準備と帰属を構築時に固定する。 */
  private constructor(props: RefinementSolverPlanParam) {
    if (props.pending.size() > 65_536 || props.compileSkips.count() > 65_536) {
      throw new IllegalArgumentException({ kind: "refinement-solver-plan-too-large" });
    }
    const targets = new Set(props.preparation.requirements().allTargetIds().toStrings());
    const unit = props.preparation.unit().name();
    for (const [, probe] of props.pending) {
      if (!probe.belongsToRequirements(props.preparation.requirements()))
        throw new IllegalArgumentException({ kind: "refinement-probe-outside-preparation" });
      if (!probe.belongsTo(UnitName.of(unit)))
        throw new IllegalArgumentException({ kind: "refinement-probe-unit-mismatch" });
      if (!targets.has(probe.reqTarget().asString()))
        throw new IllegalArgumentException({ kind: "refinement-probe-outside-preparation" });
    }
    for (const skipped of props.compileSkips) {
      if (skipped.unit() !== unit) throw new IllegalArgumentException({ kind: "refinement-solver-unit-mismatch" });
    }
    this.#preparation = props.preparation;
    this.#pending = props.pending;
    this.#compileSkips = props.compileSkips;
  }

  static of(props: RefinementSolverPlanParam): RefinementSolverPlan {
    return new RefinementSolverPlan(props);
  }

  static parse(props: RefinementSolverPlanParam): Result<RefinementSolverPlan, ParseError> {
    return parseConstruction(() => new RefinementSolverPlan(props));
  }

  preparation(): UnitRefinementPlan {
    return this.#preparation;
  }

  compileSkips(): DesignSkips {
    return this.#compileSkips;
  }

  // 発行順の Pending 走査（timeout skip の記録順——最終文書は compose が
  // 正準ソートする）。
  *[Symbol.iterator](): Iterator<readonly [QueryLabel, RefinementProbe]> {
    yield* this.#pending;
  }

  interpret(results: RefinementQueryVerdicts): { findings: DesignFindings; skipped: DesignSkips } {
    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    for (const [query, probe] of this.#pending) {
      const interpreted = probe.interpret(query, results.verdictOf(query));
      findings.push(...interpreted.findings);
      skipped.push(...interpreted.skipped);
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped) };
  }
}
