// Quint 状態機械の計画——コンパイラが機械を組んだときの対応表で、形式
// （Quint テキスト）を含まない面（種別規律の裁定 8——値オブジェクト）。旧名
// QuintMachineFacts の「事実」はドメインイベントに取っておく。判定解釈に必要な、形式（Quint テキスト）を
// 含まない面。不変量成分（帰属評価に使う式つき）・イベント義務 id・
// 全属性が束縛された init 可能シナリオの集合がここに載る。
// モジュール本文と変数名対応はアダプタのコンパイラが所有する。判定の解釈
// （旧 interpretQuintVerdicts——detail 文言は golden 凍結・返り値は未ソートで
// 正準ソートは VerificationReport.compose の不変条件、phase 2 の「既に skip
// 済みの義務は走らせない」ガードも逐語）は plan 自身の振る舞い（OOUI 裁定）。
// 対象 id は TargetId / TargetIds で運ぶ（#71 波10——生 string の列ではない）。

import { TargetIds, KeySet } from "../../kernel/domain/index.ts";
import { type QuintRuns } from "./quint-runs.ts";
import { type ObligationIds } from "./obligation-ids.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { ScenarioId } from "./scenario-id.ts";
import { AttributePath } from "../../kernel/domain/index.ts";
import { TraceState } from "./trace-state.ts";
import { TraceValue } from "./trace-value.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";

import { QuintMachineComponents } from "./quint-machine-components.ts";
import { VerificationWitness } from "./verification-witness.ts";

export class QuintMachinePlan {
  readonly #invariantComponents: QuintMachineComponents;
  readonly #eventIds: ObligationIds;
  readonly #scenariosWithInit: KeySet<ScenarioId>;

  private constructor(props: { invariantComponents: QuintMachineComponents; eventIds: ObligationIds; scenariosWithInit: KeySet<ScenarioId> }) {
    this.#invariantComponents = props.invariantComponents;
    this.#eventIds = props.eventIds;
    this.#scenariosWithInit = props.scenariosWithInit;
  }

  static of(seed: {
    readonly invariantComponents: QuintMachineComponents;
    readonly eventIds: ObligationIds;
    readonly scenariosWithInit: readonly ScenarioId[];
  }): QuintMachinePlan {
    return new QuintMachinePlan({
      invariantComponents: seed.invariantComponents,
      eventIds: seed.eventIds,
      scenariosWithInit: KeySet.of(seed.scenariosWithInit),
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
    return this.#scenariosWithInit.has(id);
  }

  // 旧 interpretQuintVerdicts の逐語移植。
  interpret(
    model: RequirementsModel,
    compileSkips: VerificationSkips,
    method: string,
    runs: QuintRuns,
  ): {
    findings: VerificationFindings;
    skipped: VerificationSkips;
  } {
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
        findings.push(VerificationFinding.reconstitute({
          kind: "completeness-gap",
          frRefs: model.frRefsOf(eventTargets),
          targets: this.#eventIds.isEmpty() ? machineTargets : eventTargets.sortedCanonically(),
          witness: machineRun.witness(),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
        }));
      } else if (machineRun.isViolation()) {
        const violatedComponents = this.#invariantComponents.violatedBy(machineRun.finalState());
        const targets = violatedComponents.isEmpty()
          ? eventTargets.sortedCanonically()
          : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
        findings.push(VerificationFinding.reconstitute({
          kind: "conflict",
          frRefs: model.frRefsOf(TargetIds.of([...targets, ...eventTargets]).sortedUniqueCanonically()),
          targets,
          witness: machineRun.witness(),
          detail: `The event machine can reach a state that violates ${targets.joined(", ")} (step trace attached): the event rules do not preserve the obligation.`,
        }));
      }
    }

    // 2) leads-to 時相義務（bounded のみ。既に skip 済みの義務は対象外）。
    for (const ob of model.obligations()) {
      if (!ob.isStateTemporal() || ob.temporal()?.pattern !== "leads-to") continue;
      const target = ob.id().asTargetId();
      if (skipped.some((s) => s.isFor(target))) continue;
      if (!bounded) {
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "capability",
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
        }));
        continue;
      }
      const r = runs.temporalOf(ob.id());
      if (!r) continue;
      const skip = r.skipFor(target);
        if (skip !== null) {
        skipped.push(skip);
      } else if (r.isViolation()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "conflict",
          frRefs: model.frRefsOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
          witness: r.witness(),
          detail: `Temporal obligation ${ob.id().asString()} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`,
        }));
      }
    }

    // 3) シナリオ検査（全属性束縛・イベントなし）：クロスチェック面。
    for (const sc of model.scenarios()) {
      const target = sc.id().asTargetId();
      if (sc.hasEvent()) {
        skipped.push(VerificationSkipped.reconstitute({ target, reason: "capability", detail: "scenarios with a When-event are not checked by the quint backend in v1" }));
        continue;
      }
      if (!this.#hasInitFor(sc.id())) {
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "capability",
          detail: "quint scenario evaluation requires bindings for every declared attribute",
        }));
        continue;
      }
      const r = runs.scenarioOf(sc.id());
      if (!r) continue;
      const skip = r.skipFor(target);
      if (skip !== null) {
        skipped.push(skip);
        continue;
      }
      const bindings = sc.bindingEntriesCanonically();
      const state = TraceState.of(bindings.map(([path, value]) => [AttributePath.reconstitute(path), TraceValue.of(value)] as const));
      const boundModel: { [path: string]: boolean | number | string } = {};
      for (const [path, value] of bindings) boundModel[path] = value;
      if (sc.isAccept() && r.isViolated()) {
        const violatedComponents = this.#invariantComponents.violatedBy(state);
        const targets = TargetIds.of([target, ...violatedComponents.ids().toTargetIds()]).sortedUniqueCanonically();
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(targets),
          targets,
          witness: VerificationWitness.model(boundModel),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations rule out — the requirements reject an example that should be accepted.`,
        }));
      }
      if (sc.isReject() && !r.isViolated()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
          witness: VerificationWitness.model(boundModel),
          detail: `Reject scenario ${sc.id().asString()} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
        }));
      }
    }

    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
