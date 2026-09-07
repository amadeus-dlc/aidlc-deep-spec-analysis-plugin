import { type KeyedIndex, type QueryLabel, UnitName } from "@deep-spec-analysis/kernel-domain";

// 準備元に属する問いと発行順を固定するソルバ計画。
// 各問いが判定を解釈し、計画は診断を収集する。

import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignFindings } from "./design-findings.ts";
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
    const unit = props.preparation.unit().name();
    for (const [, probe] of props.pending) {
      if (!probe.belongsToRequirements(props.preparation.requirements()))
        throw new IllegalArgumentException({ kind: "refinement-probe-outside-preparation" });
      if (!probe.belongsTo(UnitName.of(unit)))
        throw new IllegalArgumentException({ kind: "refinement-probe-unit-mismatch" });
    }
    if (props.compileSkips.exists((skipped) => skipped.unit() !== unit))
      throw new IllegalArgumentException({ kind: "refinement-solver-unit-mismatch" });
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
    let findings = DesignFindings.of([]);
    let skipped = DesignSkips.of([]);
    for (const [query, probe] of this.#pending) {
      const interpreted = probe.interpret(query, results.verdictOf(query));
      findings = findings.combine(interpreted.findings);
      skipped = skipped.combine(interpreted.skipped);
    }
    return { findings, skipped };
  }
}
