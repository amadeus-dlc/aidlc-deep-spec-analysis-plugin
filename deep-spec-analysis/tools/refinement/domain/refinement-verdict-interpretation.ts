// refinement ソルバ判定の解釈 — 4 種の検査（静的 refinement 違反・シナリオ
// 再生・enabledness・ワンステップシミュレーション）を型付き判定から
// findings / skips へ写す純関数。detail 文言（golden 凍結）を逐語所有。
// 旧 runUnitRefinementSmt の結果ループからの逐語移植。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { DesignFinding, DesignSkipped } from "../../design/domain/index.ts";
import type { UnitRefinementPlan } from "./refinement-plan.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";
import type { RefinementQueryVerdict, RefinementSolverFacts } from "./refinement-solver-verdict.ts";

export interface InterpretedRefinementVerdicts {
  findings: DesignFinding[];
  skipped: DesignSkipped[];
}

export function interpretRefinementVerdicts(
  unitName: string,
  req: RefinementRequirements,
  plan: UnitRefinementPlan,
  facts: RefinementSolverFacts,
  results: ReadonlyMap<string, RefinementQueryVerdict>,
): InterpretedRefinementVerdicts {
  const findings: DesignFinding[] = [];
  const skipped: DesignSkipped[] = [];
  const frOf = (reqId: string): string[] => sortedUnique(req.frRefsOf(reqId), idCompare);

  for (const [queryId, p] of facts.pending) {
    const r = results.get(queryId);
    if (!r || r.status === "unknown" || r.status === "budget" || r.status === "error") {
      skipped.push({ target: p.reqId, reason: "timeout", unit: unitName, detail: `refinement query ${queryId} exceeded the solver budget or errored` });
      continue;
    }
    if (p.kind === "invariant") {
      if (r.status === "sat") {
        findings.push({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: [p.reqId],
          witness: { model: r.decodedModel ?? {} },
          unit: unitName,
          detail: `A design-legal state of unit ${unitName} violates requirements obligation ${p.reqId} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`,
        });
      }
    } else if (p.kind === "scenario") {
      const sc = req.scenarioById(p.reqId);
      if (sc?.kind === "accept" && r.status === "unsat") {
        findings.push({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: [p.reqId],
          witness: { core: [...(r.core ?? [])].sort() },
          unit: unitName,
          detail: `Accept scenario ${p.reqId} has no design-legal counterpart in unit ${unitName} under the refinement map: the design excludes an example the requirements accept (witness core attached).`,
        });
      }
      if (sc?.kind === "reject" && r.status === "sat") {
        findings.push({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: [p.reqId],
          witness: { model: r.decodedModel ?? {} },
          unit: unitName,
          detail: `Reject scenario ${p.reqId} is still admitted by unit ${unitName} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`,
        });
      }
    } else if (p.kind === "enabledness") {
      if (r.status === "sat") {
        findings.push({
          kind: "completeness-gap",
          frRefs: frOf(p.reqId),
          targets: sortedUnique([p.reqId, ...(plan.eventTransitions.get(p.reqId) ?? [])], idCompare),
          witness: { model: r.decodedModel ?? {} },
          unit: unitName,
          detail: `The requirements event ${p.reqId} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`,
        });
      }
    } else if (p.kind === "simulation") {
      if (r.status === "sat") {
        findings.push({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: sortedUnique([p.reqId, p.designId ?? ""], idCompare).filter((t) => t !== ""),
          witness: { trace: [r.decodedModel ?? {}, r.decodedPostModel ?? {}] },
          unit: unitName,
          detail: `Design step ${p.designId} of unit ${unitName}, taken where requirements event ${p.reqId} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`,
        });
      }
    }
  }
  return { findings, skipped };
}
