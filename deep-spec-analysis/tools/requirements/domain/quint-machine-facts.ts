// Quint 状態機械の「事実」——判定解釈に必要な、形式（Quint テキスト）を
// 含まない面。不変量成分（帰属評価に使う式つき）・イベント義務 id・
// 全属性が束縛された init 可能シナリオの集合がここに載る。
// モジュール本文と変数名対応はアダプタのコンパイラが所有する。判定の解釈
// （旧 interpretQuintVerdicts——detail 文言は golden 凍結・返り値は未ソートで
// 正準ソートは VerificationReport.compose の不変条件、phase 2 の「既に skip
// 済みの義務は走らせない」ガードも逐語）は facts 自身の振る舞い（OOUI 裁定）。
// 対象 id は TargetId / TargetIds で運ぶ（#71 波10——生 string の列ではない）。

import { TargetIds } from "../../kernel/domain/index.ts";
import { type QuintRuns } from "./quint-runs.ts";
import { type ObligationIds } from "./obligation-ids.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { ScenarioId } from "./scenario-id.ts";
import type { TraceState } from "./trace-state.ts";
import type { VerificationFinding } from "./verification-finding.ts";
import { type VerificationSkipped } from "./verification-skipped.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";
import type { InterpretedQuintVerdicts } from "./interpreted-quint-verdicts.ts";
import { QuintMachineComponents } from "./quint-machine-components.ts";
import type { QuintMachineFactsSeed } from "./quint-machine-facts-seed.ts";

export class QuintMachineFacts {
  readonly #invariantComponents: QuintMachineComponents;
  readonly #eventIds: ObligationIds;
  readonly #scenariosWithInit: ReadonlySet<string>;

  private constructor(props: { invariantComponents: QuintMachineComponents; eventIds: ObligationIds; scenariosWithInit: ReadonlySet<string> }) {
    this.#invariantComponents = props.invariantComponents;
    this.#eventIds = props.eventIds;
    this.#scenariosWithInit = props.scenariosWithInit;
  }

  static of(seed: QuintMachineFactsSeed): QuintMachineFacts {
    return new QuintMachineFacts({
      invariantComponents: seed.invariantComponents,
      eventIds: seed.eventIds,
      scenariosWithInit: new Set(seed.scenariosWithInit.map((id) => id.asString())),
    });
  }

  hasInvariantComponents(): boolean {
    return !this.#invariantComponents.isEmpty();
  }

  // 機械フェーズが検査する対象の全 id（成分 + イベント義務、正準順・一意）。
  machineTargets(): TargetIds {
    return TargetIds.of([...this.#invariantComponents.ids().toTargetIds(), ...this.#eventIds.toTargetIds()]).sortedUniqueCanonically();
  }

  // 全属性が束縛され init アクションが emit されたシナリオか。
  #hasInitFor(id: ScenarioId): boolean {
    return this.#scenariosWithInit.has(id.asString());
  }

  // 旧 interpretQuintVerdicts の逐語移植。
  interpret(
    model: RequirementsModel,
    compileSkips: VerificationSkips,
    method: string,
    runs: QuintRuns,
  ): InterpretedQuintVerdicts {
    const bounded = method === "bounded";
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...compileSkips.toArray()];
    const machineTargets = this.machineTargets();
    const eventTargets = this.#eventIds.toTargetIds();

    // 1) イベント機械下で到達可能な不変量違反・デッドロック。
    const machineRun = runs.machineRun();
    if (machineRun !== null) {
      // timeout / run-failed の対象一括 skip は判定が組む（#71 波8）。
      skipped.push(...machineRun.skipsFor(machineTargets, bounded));
      if (machineRun.isDeadlock()) {
        findings.push({
          kind: "completeness-gap",
          frRefs: model.frRefsOf(eventTargets),
          targets: this.#eventIds.isEmpty() ? machineTargets : eventTargets.sortedCanonically(),
          witness: machineRun.witness(),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
        });
      } else if (machineRun.isViolation()) {
        const violatedComponents = this.#invariantComponents.violatedBy(machineRun.finalState());
        const targets = violatedComponents.isEmpty()
          ? eventTargets.sortedCanonically()
          : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
        findings.push({
          kind: "conflict",
          frRefs: model.frRefsOf(TargetIds.of([...targets, ...eventTargets]).sortedUniqueCanonically()),
          targets,
          witness: machineRun.witness(),
          detail: `The event machine can reach a state that violates ${targets.joined(", ")} (step trace attached): the event rules do not preserve the obligation.`,
        });
      }
    }

    // 2) leads-to 時相義務（bounded のみ。既に skip 済みの義務は対象外）。
    for (const ob of model.obligations()) {
      if (!ob.isStateTemporal() || ob.temporal()?.pattern !== "leads-to") continue;
      const target = ob.id().asTargetId();
      if (skipped.some((s) => s.target.equals(target))) continue;
      if (!bounded) {
        skipped.push({
          target,
          reason: "capability",
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
        });
        continue;
      }
      const r = runs.temporalOf(ob.id());
      if (!r) continue;
      if (r.kind === "timeout") {
        skipped.push({ target, reason: "timeout", detail: "temporal check exceeded its budget" });
      } else if (r.kind === "violation") {
        findings.push({
          kind: "conflict",
          frRefs: model.frRefsOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
          witness: { trace: r.trace.toArray() },
          detail: `Temporal obligation ${ob.id().asString()} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`,
        });
      }
    }

    // 3) シナリオ検査（全属性束縛・イベントなし）：クロスチェック面。
    for (const sc of model.scenarios()) {
      const target = sc.id().asTargetId();
      if (sc.hasEvent()) {
        skipped.push({ target, reason: "capability", detail: "scenarios with a When-event are not checked by the quint backend in v1" });
        continue;
      }
      if (!this.#hasInitFor(sc.id())) {
        skipped.push({
          target,
          reason: "capability",
          detail: "quint scenario evaluation requires bindings for every declared attribute",
        });
        continue;
      }
      const r = runs.scenarioOf(sc.id());
      if (!r) continue;
      if (r.kind === "timeout" || r.kind === "run-failed") {
        skipped.push({
          target,
          reason: r.kind === "timeout" ? "timeout" : "unavailable",
          detail: r.kind === "timeout"
            ? "scenario evaluation exceeded its budget"
            : `quint run failed unexpectedly: ${r.outputTail}`,
        });
        continue;
      }
      const state: TraceState & { [path: string]: boolean | number | string } = {};
      for (const [path, value] of sc.bindingEntriesCanonically()) state[path] = value;
      if (sc.isAccept() && r.violated) {
        const violatedComponents = this.#invariantComponents.violatedBy(state);
        const targets = TargetIds.of([target, ...violatedComponents.ids().toTargetIds()]).sortedUniqueCanonically();
        findings.push({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(targets),
          targets,
          witness: { model: state },
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations rule out — the requirements reject an example that should be accepted.`,
        });
      }
      if (sc.isReject() && !r.violated) {
        findings.push({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
          witness: { model: state },
          detail: `Reject scenario ${sc.id().asString()} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
        });
      }
    }

    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
