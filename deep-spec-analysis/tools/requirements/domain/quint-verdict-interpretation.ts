// Quint 実行判定の解釈 — (1) イベント機械下の不変量保存（違反トレースの
// 帰属評価つき）とデッドロック、(2) leads-to 時相義務（bounded のみ）、
// (3) 全属性束縛のイベントなしシナリオ、を型付き判定と機械事実から
// findings / skipped へ写す純関数。detail 文言（golden 凍結）を逐語所有。
// 返り値は未ソート——正準ソートは VerificationReport.compose の不変条件。
// phase 2 の「既に skip 済みの義務は走らせない」ガード（蓄積 skip 配列への
// 参照）も旧 main の逐語移植。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import { evaluateExpression } from "./expression-evaluation.ts";
import type { QuintMachineFacts } from "./quint-machine-facts.ts";
import type { QuintRuns } from "./quint-verdict.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { TraceState } from "./trace-state.ts";
import type { VerificationFinding, VerificationSkipped } from "./verification-finding.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

export interface InterpretedQuintVerdicts {
  findings: VerificationFindings;
  skipped: VerificationSkips;
}

export function interpretQuintVerdicts(
  model: RequirementsModel,
  facts: QuintMachineFacts,
  compileSkips: readonly VerificationSkipped[],
  method: string,
  runs: QuintRuns,
): InterpretedQuintVerdicts {
  const bounded = method === "bounded";
  const findings: VerificationFinding[] = [];
  const skipped: VerificationSkipped[] = [...compileSkips];
  const machineTargets = sortedUnique(
    [...facts.invariantComponents.map((c) => c.id), ...facts.eventIds],
    idCompare,
  );

  // 1) イベント機械下で到達可能な不変量違反・デッドロック。
  if (runs.machine !== null) {
    const run = runs.machine;
    if (run.kind === "timeout") {
      for (const t of machineTargets) {
        skipped.push({ target: t, reason: "timeout", detail: "machine invariant check exceeded its budget" });
      }
    } else if (run.kind === "deadlock") {
      findings.push({
        kind: "completeness-gap",
        frRefs: model.frRefsOf(facts.eventIds),
        targets: facts.eventIds.length > 0 ? [...facts.eventIds].sort(idCompare) : machineTargets,
        witness: run.trace !== null ? { trace: run.trace } : { model: {} },
        detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
      });
    } else if (run.kind === "violation") {
      const finalState = run.trace[run.trace.length - 1] ?? {};
      const violatedComponents = facts.invariantComponents.filter((c) => evaluateExpression(c.expr, finalState) !== true);
      const targets =
        violatedComponents.length > 0
          ? sortedUnique(violatedComponents.map((c) => c.id), idCompare)
          : [...facts.eventIds].sort(idCompare);
      findings.push({
        kind: "conflict",
        frRefs: model.frRefsOf(sortedUnique([...targets, ...facts.eventIds], idCompare)),
        targets,
        witness: { trace: run.trace },
        detail: `The event machine can reach a state that violates ${targets.join(", ")} (step trace attached): the event rules do not preserve the obligation.`,
      });
    } else if (run.kind === "run-failed") {
      for (const t of machineTargets) {
        skipped.push({
          target: t,
          reason: "unavailable",
          detail: `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${run.outputTail}`,
        });
      }
    }
  }

  // 2) leads-to 時相義務（bounded のみ。既に skip 済みの義務は対象外）。
  for (const ob of model.obligations()) {
    if (ob.nature !== "state-temporal" || ob.temporal?.pattern !== "leads-to") continue;
    if (skipped.some((s) => s.target === ob.id)) continue;
    if (!bounded) {
      skipped.push({
        target: ob.id,
        reason: "capability",
        detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
      });
      continue;
    }
    const r = runs.temporals.get(ob.id);
    if (!r) continue;
    if (r.kind === "timeout") {
      skipped.push({ target: ob.id, reason: "timeout", detail: "temporal check exceeded its budget" });
    } else if (r.kind === "violation") {
      findings.push({
        kind: "conflict",
        frRefs: model.frRefsOf([ob.id]),
        targets: [ob.id],
        witness: { trace: r.trace },
        detail: `Temporal obligation ${ob.id} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`,
      });
    }
  }

  // 3) シナリオ検査（全属性束縛・イベントなし）：クロスチェック面。
  for (const sc of model.scenarios()) {
    if (sc.event) {
      skipped.push({ target: sc.id, reason: "capability", detail: "scenarios with a When-event are not checked by the quint backend in v1" });
      continue;
    }
    if (!facts.scenariosWithInit.has(sc.id)) {
      skipped.push({
        target: sc.id,
        reason: "capability",
        detail: "quint scenario evaluation requires bindings for every declared attribute",
      });
      continue;
    }
    const r = runs.scenarios.get(sc.id);
    if (!r) continue;
    if (r.kind === "timeout" || r.kind === "run-failed") {
      skipped.push({
        target: sc.id,
        reason: r.kind === "timeout" ? "timeout" : "unavailable",
        detail: r.kind === "timeout"
          ? "scenario evaluation exceeded its budget"
          : `quint run failed unexpectedly: ${r.outputTail}`,
      });
      continue;
    }
    const state: TraceState & { [path: string]: boolean | number | string } = {};
    for (const [path, value] of Object.entries(sc.bindings)) state[path] = value;
    if (sc.kind === "accept" && r.violated) {
      const violatedComponents = facts.invariantComponents.filter((c) => evaluateExpression(c.expr, state) !== true);
      const targets = sortedUnique([sc.id, ...violatedComponents.map((c) => c.id)], idCompare);
      findings.push({
        kind: "scenario-violation",
        frRefs: model.frRefsOf(targets),
        targets,
        witness: { model: state },
        detail: `Accept scenario ${sc.id} describes a state the obligations rule out — the requirements reject an example that should be accepted.`,
      });
    }
    if (sc.kind === "reject" && !r.violated) {
      findings.push({
        kind: "scenario-violation",
        frRefs: model.frRefsOf([sc.id]),
        targets: [sc.id],
        witness: { model: state },
        detail: `Reject scenario ${sc.id} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
      });
    }
  }

  return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
}
