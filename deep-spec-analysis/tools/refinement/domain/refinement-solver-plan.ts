// refinement ソルバ実行の型付き判定と計画（対応表）。SMT-LIB スクリプト・z3 の生
// 表現はアダプタ（第 2 コンパイラ＋クライアント）が持ち、ドメインへは
// クエリ id（"rv:OB-x" / "re:OB-x" / "rs2:OB-x:TR-y" / "rs:SC-x"）ごとの
// 判定と、その id が何の検査だったか（Pending）だけが届く。decoded モデルは
// pre / post（primed）の両状態。判定の解釈（4 種の検査 → findings / skips、
// detail 文言は golden 凍結）は plan 自身の振る舞い（OOUI 裁定——旧
// interpretRefinementVerdicts の逐語移植）。

import { FrRefs, TargetIds } from "../../kernel/domain/index.ts";
import { DesignFinding, DesignFindings, DesignSkips } from "../../design/domain/index.ts";
import { DesignSkipped } from "../../design/domain/index.ts";
import { type UnitRefinementPlan } from "./unit-refinement-plan.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

import type { RefinementProbe } from "./refinement-probe.ts";
import { RefinementQueryVerdicts } from "./refinement-query-verdicts.ts";

// クエリ計画（値オブジェクト、裁定 8——旧 RefinementSolverFacts）：発行順の Pending 索引と、alpha 置換・SMT コンパイル失敗
// による compile-error skip（構築時に確定）。
export class RefinementSolverPlan {
  readonly #pending: ReadonlyMap<string, RefinementProbe>;
  readonly #compileSkips: DesignSkips;

  private constructor(props: { pending: ReadonlyMap<string, RefinementProbe>; compileSkips: DesignSkips }) {
    this.#pending = props.pending;
    this.#compileSkips = props.compileSkips;
  }

  static of(props: { pending: ReadonlyMap<string, RefinementProbe>; compileSkips: DesignSkips }): RefinementSolverPlan {
    return new RefinementSolverPlan({ pending: new Map(props.pending), compileSkips: props.compileSkips });
  }

  compileSkips(): DesignSkips {
    return this.#compileSkips;
  }

  // 発行順の Pending 走査（timeout skip の記録順——最終文書は compose が
  // 正準ソートする）。
  *[Symbol.iterator](): Iterator<readonly [string, RefinementProbe]> {
    yield* this.#pending.entries();
  }

  // 旧 interpretRefinementVerdicts の逐語移植。
  interpret(
    results: RefinementQueryVerdicts,
    req: RefinementRequirements,
    plan: UnitRefinementPlan,
    unitName: string,
  ): {
    findings: DesignFindings;
    skipped: DesignSkips;
  } {
    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const frOf = (reqId: string): FrRefs => FrRefs.of([...req.frRefsOf(reqId)]).sortedUnique();

    for (const [queryId, p] of this.#pending) {
      const r = results.verdictOf(queryId);
      if (!r || r.isUndecided()) {
        skipped.push(DesignSkipped.reconstitute({ target: p.reqTarget(), reason: "timeout", unit: unitName, detail: `refinement query ${queryId} exceeded the solver budget or errored` }));
        continue;
      }
      // 種類ごとの解釈は問いへ命じる（#71 波22）。
      p.match({
        invariant: (reqId) => {
          if (r.isSat()) {
            findings.push(
              DesignFinding.reconstitute({
                kind: "refinement-violation",
                frRefs: frOf(reqId.asString()),
                targets: TargetIds.reconstitute([reqId.asString()]),
                witness: { model: r.witnessModel() },
                unit: unitName,
                detail: `A design-legal state of unit ${unitName} violates requirements obligation ${reqId.asString()} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`,
              }),
            );
          }
        },
        scenario: (reqId) => {
          const sc = req.scenarioById(reqId.asString());
          if (sc?.isAccept() === true && r.isUnsat()) {
            findings.push(
              DesignFinding.reconstitute({
                kind: "refinement-violation",
                frRefs: frOf(reqId.asString()),
                targets: TargetIds.reconstitute([reqId.asString()]),
                witness: { core: r.sortedCore() },
                unit: unitName,
                detail: `Accept scenario ${reqId.asString()} has no design-legal counterpart in unit ${unitName} under the refinement map: the design excludes an example the requirements accept (witness core attached).`,
              }),
            );
          }
          if (sc?.isReject() === true && r.isSat()) {
            findings.push(
              DesignFinding.reconstitute({
                kind: "refinement-violation",
                frRefs: frOf(reqId.asString()),
                targets: TargetIds.reconstitute([reqId.asString()]),
                witness: { model: r.witnessModel() },
                unit: unitName,
                detail: `Reject scenario ${reqId.asString()} is still admitted by unit ${unitName} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`,
              }),
            );
          }
        },
        enabledness: (reqId) => {
          if (r.isSat()) {
            findings.push(
              DesignFinding.reconstitute({
                kind: "completeness-gap",
                frRefs: frOf(reqId.asString()),
                targets: TargetIds.reconstitute([reqId.asString(), ...plan.mappedTransitionsOf(reqId.asString()).map((t) => t.asString())]).sortedUniqueCanonically(),
                witness: { model: r.witnessModel() },
                unit: unitName,
                detail: `The requirements event ${reqId.asString()} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`,
              }),
            );
          }
        },
        simulation: (reqId, designId) => {
          if (r.isSat()) {
            findings.push(
              DesignFinding.reconstitute({
                kind: "refinement-violation",
                frRefs: frOf(reqId.asString()),
                // simulation probe の designId は構築時に必須——旧 `?? ""` +空除去は
                // designId 未設定の防御で、必須化により恒等（挙動保存）。
                targets: TargetIds.reconstitute([reqId.asString(), designId.asString()].filter((t) => t !== "")).sortedUniqueCanonically(),
                witness: { trace: r.witnessTrace() },
                unit: unitName,
                detail: `Design step ${designId.asString()} of unit ${unitName}, taken where requirements event ${reqId.asString()} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`,
              }),
            );
          }
        },
      });
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped) };
  }
}
