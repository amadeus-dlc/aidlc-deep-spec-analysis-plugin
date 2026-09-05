import { SkipReason, FindingKind, TargetIds, KeySet } from "@deep-spec/kernel-domain";

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

import { type QuintRuns } from "./quint-runs.ts";
import { type ObligationIds } from "./obligation-ids.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { ScenarioId } from "./scenario-id.ts";

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
    //
    // 結果そのものが無いときは黙って飛ばさない。飛ばすと「実行できなかった」と
    // 「違反が無かった」が findings 0 件の同じ姿になり、縮退が pass に化ける。
    // 判定を出せなかったことは unavailable として言う（run-failed の skip と
    // 同じ語彙——バックエンドが答えを返さなかった、という同じ事実）。
    const machineRun = runs.machineRun();
    if (machineRun === null) {
      for (const target of machineTargets) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: "quint returned no machine run: the event machine was not decided",
        }));
      }
    }
    if (machineRun !== null) {
      // timeout / run-failed の対象一括 skip は判定が組む（#71 波8）。
      skipped.push(...machineRun.skipsFor(machineTargets, bounded));
      if (machineRun.isDeadlock()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.completenessGap(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(eventTargets),
          targets: this.#eventIds.isEmpty() ? machineTargets : eventTargets.sortedCanonically(),
          witness: machineRun.witness(),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
        }));
      } else if (machineRun.isViolation()) {
        const violatedComponents = this.#invariantComponents.violatedBy(machineRun.finalState());
        const targets = violatedComponents.isEmpty()
          ? eventTargets.sortedCanonically()
          : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
        findings.push(VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIds.of([...targets, ...eventTargets]).sortedUniqueCanonically()),
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
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("capability"),
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
        }));
        continue;
      }
      const r = runs.temporalOf(ob.id());
      if (!r) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: "quint returned no run for this temporal obligation",
        }));
        continue;
      }
      const skip = r.skipFor(target);
        if (skip !== null) {
        skipped.push(skip);
      } else if (r.isViolation()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIds.of([target])),
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
        skipped.push(VerificationSkipped.of({ target, reason: SkipReason.of("capability"), detail: "scenarios with a When-event are not checked by the quint backend in v1" }));
        continue;
      }
      if (!this.#hasInitFor(sc.id())) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("capability"),
          detail: "quint scenario evaluation requires bindings for every declared attribute",
        }));
        continue;
      }
      const r = runs.scenarioOf(sc.id());
      if (!r) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: "quint returned no run for this scenario",
        }));
        continue;
      }
      const skip = r.skipFor(target);
      if (skip !== null) {
        skipped.push(skip);
        continue;
      }
      const bindings = sc.bindings().entriesCanonically();
      const state = TraceState.of(bindings.map((binding) => [binding.path(), TraceValue.of(binding.value().toDocument())] as const));
      const boundModel = sc.bindings().toDocument();
      if (sc.isAccept() && r.isViolated()) {
        const violatedComponents = this.#invariantComponents.violatedBy(state);
        const targets = TargetIds.of([target, ...violatedComponents.ids().toTargetIds()]).sortedUniqueCanonically();
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
          targets,
          witness: VerificationWitness.model(boundModel),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations rule out — the requirements reject an example that should be accepted.`,
        }));
      }
      if (sc.isReject() && !r.isViolated()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
          witness: VerificationWitness.model(boundModel),
          detail: `Reject scenario ${sc.id().asString()} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
        }));
      }
    }

    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
