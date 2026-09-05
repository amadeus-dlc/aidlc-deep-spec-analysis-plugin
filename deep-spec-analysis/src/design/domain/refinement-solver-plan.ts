import {
  FindingKind,
  type FunctionalRequirementReferences,
  type KeyedIndex,
  type QueryLabel,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  UnitName,
} from "@deep-spec/kernel-domain";

// refinement ソルバ実行の型付き判定と計画（対応表）。SMT-LIB スクリプト・z3 の生
// 表現はアダプタ（第 2 コンパイラ＋クライアント）が持ち、ドメインへは
// クエリ id（"rv:OB-x" / "re:OB-x" / "rs2:OB-x:TR-y" / "rs:SC-x"）ごとの
// 判定と、その id が何の検査だったか（Pending）だけが届く。decoded モデルは
// pre / post（primed）の両状態。判定の解釈（4 種の検査 → findings / skips、
// detail 文言は golden 凍結）は plan 自身の振る舞い（OOUI 裁定——旧
// interpretRefinementVerdicts の逐語移植）。

import { DesignFinding, DesignFindings, DesignSkipped, DesignSkips, DesignWitness } from "@deep-spec/design-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
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

  // 旧 interpretRefinementVerdicts の逐語移植。
  interpret(results: RefinementQueryVerdicts): {
    findings: DesignFindings;
    skipped: DesignSkips;
  } {
    const plan = this.#preparation;
    const req = plan.requirements();
    const unitName = plan.unit().name();
    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const functionalRequirementReferencesOf = (reqId: string): FunctionalRequirementReferences =>
      req.functionalRequirementReferencesOf(reqId).sortedUnique();

    for (const [queryId, p] of this.#pending) {
      const r = results.verdictOf(queryId);
      if (!r || r.isUndecided()) {
        skipped.push(
          DesignSkipped.of({
            target: p.reqTarget(),
            reason: SkipReason.timeout(),
            unit: UnitName.of(unitName),
            detail: `refinement query ${queryId.asString()} exceeded the solver budget or errored`,
          }),
        );
        continue;
      }
      // 種類ごとの解釈は問いへ命じる（#71 波22）。
      p.match({
        invariant: (reqId) => {
          if (r.isSat()) {
            findings.push(
              DesignFinding.of({
                kind: FindingKind.refinementViolation(),
                functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
                targets: TargetIdentifiers.of(Array.from([reqId.asString()], (raw) => TargetIdentifier.of(raw))),
                witness: DesignWitness.model(r.witnessModel()),
                unit: UnitName.of(unitName),
                detail: `A design-legal state of unit ${unitName} violates requirements obligation ${reqId.asString()} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`,
              }),
            );
          }
        },
        scenario: (reqId) => {
          const sc = req.scenarioById(reqId.asString());
          if (sc?.isAccept() === true && r.isUnsat()) {
            findings.push(
              DesignFinding.of({
                kind: FindingKind.refinementViolation(),
                functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
                targets: TargetIdentifiers.of(Array.from([reqId.asString()], (raw) => TargetIdentifier.of(raw))),
                witness: DesignWitness.core(r.sortedCore()),
                unit: UnitName.of(unitName),
                detail: `Accept scenario ${reqId.asString()} has no design-legal counterpart in unit ${unitName} under the refinement map: the design excludes an example the requirements accept (witness core attached).`,
              }),
            );
          }
          if (sc?.isReject() === true && r.isSat()) {
            findings.push(
              DesignFinding.of({
                kind: FindingKind.refinementViolation(),
                functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
                targets: TargetIdentifiers.of(Array.from([reqId.asString()], (raw) => TargetIdentifier.of(raw))),
                witness: DesignWitness.model(r.witnessModel()),
                unit: UnitName.of(unitName),
                detail: `Reject scenario ${reqId.asString()} is still admitted by unit ${unitName} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`,
              }),
            );
          }
        },
        enabledness: (reqId) => {
          if (r.isSat()) {
            findings.push(
              DesignFinding.of({
                kind: FindingKind.completenessGap(),
                functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
                targets: TargetIdentifiers.of(
                  Array.from(
                    [reqId.asString(), ...plan.mappedTransitionsOf(reqId.asString()).map((t) => t.asString())],
                    (raw) => TargetIdentifier.of(raw),
                  ),
                ).sortedUniqueCanonically(),
                witness: DesignWitness.model(r.witnessModel()),
                unit: UnitName.of(unitName),
                detail: `The requirements event ${reqId.asString()} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`,
              }),
            );
          }
        },
        simulation: (reqId, designId) => {
          if (r.isSat()) {
            findings.push(
              DesignFinding.of({
                kind: FindingKind.refinementViolation(),
                functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
                // simulation probe の designId は構築時に必須——旧 `?? ""` +空除去は
                // designId 未設定の防御で、必須化により恒等（挙動保存）。
                targets: TargetIdentifiers.of(
                  Array.from(
                    [reqId.asString(), designId.asString()].filter((t) => t !== ""),
                    (raw) => TargetIdentifier.of(raw),
                  ),
                ).sortedUniqueCanonically(),
                witness: DesignWitness.trace(r.witnessTrace()),
                unit: UnitName.of(unitName),
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
