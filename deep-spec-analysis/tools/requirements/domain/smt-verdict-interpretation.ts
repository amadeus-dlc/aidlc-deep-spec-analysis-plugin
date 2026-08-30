// ソルバ判定の解釈 — (a) 大域一貫性・前件空虚・同トリガ矛盾効果の conflict、
// (b) トリガごとの完全性ギャップ、(c) シナリオ検査を、型付き判定と計画事実
// から findings / skipped へ写す純関数。detail 文言（golden 凍結）を逐語所有。
// 返り値は未ソート——正準ソートは VerificationReport.compose の不変条件。
// 旧 parentMain の解釈部からの逐語移植。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SmtPlanFacts } from "./smt-plan-facts.ts";
import type { SmtQueryVerdict } from "./solver-verdict.ts";
import type { VerificationFinding, VerificationSkipped } from "./verification-finding.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

export interface InterpretedVerdicts {
  findings: VerificationFindings;
  skipped: VerificationSkips;
}

export function interpretSmtVerdicts(
  model: RequirementsModel,
  facts: SmtPlanFacts,
  results: ReadonlyMap<string, SmtQueryVerdict>,
): InterpretedVerdicts {
  const findings: VerificationFinding[] = [];
  const skipped: VerificationSkipped[] = [...facts.skipped];
  const conflictKeys = new Set<string>();
  const invariantIds = model
    .obligations()
    .toArray()
    .filter((o) => (o.nature === "invariant" || o.nature === "numeric") && facts.compiled.get(o.id))
    .map((o) => o.id);

  const coreToTargets = (core: string[]): string[] => {
    const targets = core
      .map((label) => facts.labelToTarget.get(label))
      .filter((t): t is string => typeof t === "string" && t.startsWith("OB-"));
    return sortedUnique(targets, idCompare);
  };

  const addConflict = (targets: string[], core: string[], detail: string): void => {
    const effective = targets.length > 0 ? targets : invariantIds;
    if (effective.length === 0) return;
    const key = effective.join(",");
    if (conflictKeys.has(key)) return;
    conflictKeys.add(key);
    findings.push({
      kind: "conflict",
      frRefs: model.frRefsOf(effective),
      targets: effective,
      witness: { core: [...core].sort() },
      detail,
    });
  };

  const timeoutSkip = (targets: string[], what: string): void => {
    for (const t of targets) {
      skipped.push({ target: t, reason: "timeout", detail: `${what} exceeded the solver budget` });
    }
  };

  // (a) 大域一貫性。
  const global = results.get("global");
  let globallyUnsat = false;
  if (global?.status === "unsat") {
    globallyUnsat = true;
    addConflict(
      coreToTargets(global.core ?? []),
      global.core ?? [],
      "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.",
    );
  } else if (global && global.status !== "sat") {
    timeoutSkip(invariantIds, "global consistency check");
  }

  // (a) 前件空虚（大域 unsat のときは冗長な派生なので黙る）。
  if (!globallyUnsat) {
    for (const ob of model.obligations()) {
      const r = results.get(`vac:${ob.id}`);
      if (!r) continue;
      if (r.status === "unsat") {
        const targets = sortedUnique([...coreToTargets(r.core ?? []), ob.id], idCompare);
        addConflict(
          targets,
          r.core ?? [],
          `The condition of obligation ${ob.id} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`,
        );
      } else if (r.status !== "sat") {
        timeoutSkip([ob.id], `vacuity check for ${ob.id}`);
      }
    }
  }

  // (a) 同トリガの矛盾効果。
  for (const pair of facts.eventPairs) {
    const overlap = results.get(pair.qOverlap);
    const joint = results.get(pair.qJoint);
    if (!overlap || !joint) continue;
    if (overlap.status === "sat" && joint.status === "unsat") {
      addConflict(
        sortedUnique([pair.a, pair.b], idCompare),
        joint.core ?? [],
        `Events ${pair.a} and ${pair.b} for trigger "${pair.trigger}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`,
      );
    } else if (overlap.status === "unknown" || overlap.status === "budget" || joint.status === "unknown" || joint.status === "budget") {
      timeoutSkip([pair.a, pair.b], `event-pair check for trigger "${pair.trigger}"`);
    }
  }

  // (b) 完全性ギャップ。
  for (const [trigger, eventIds] of [...facts.gapTriggers.entries()].sort()) {
    const r = results.get(`gap:${trigger}`);
    if (!r) continue;
    if (r.status === "sat") {
      findings.push({
        kind: "completeness-gap",
        frRefs: model.frRefsOf(eventIds),
        targets: [...eventIds],
        witness: { model: r.decodedModel ?? {} },
        detail: `No rule for trigger "${trigger}" applies to the witness state: the behavior of this input region is unspecified.`,
      });
    } else if (r.status !== "unsat") {
      timeoutSkip([...eventIds], `completeness check for trigger "${trigger}"`);
    }
  }

  // (c) シナリオ。
  for (const sc of model.scenarios()) {
    const qid = facts.scenarioQueries.get(sc.id);
    if (!qid) continue;
    const r = results.get(qid);
    if (!r) continue;
    if (r.status === "unknown" || r.status === "budget" || r.status === "error") {
      timeoutSkip([sc.id], `scenario check for ${sc.id}`);
      continue;
    }
    if (sc.kind === "accept" && r.status === "unsat") {
      const targets = sortedUnique([sc.id, ...coreToTargets(r.core ?? [])], idCompare);
      findings.push({
        kind: "scenario-violation",
        frRefs: model.frRefsOf(targets),
        targets,
        witness: { core: [...(r.core ?? [])].sort() },
        detail: `Accept scenario ${sc.id} describes a state the obligations in the witness core rule out — the requirements reject an example that should be accepted.`,
      });
    }
    if (sc.kind === "reject" && r.status === "sat") {
      findings.push({
        kind: "scenario-violation",
        frRefs: model.frRefsOf([sc.id]),
        targets: [sc.id],
        witness: { model: r.decodedModel ?? {} },
        detail: `Reject scenario ${sc.id} is still satisfiable — the requirements do not exclude an example that should be rejected (witness state attached).`,
      });
    }
  }

  return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
}
