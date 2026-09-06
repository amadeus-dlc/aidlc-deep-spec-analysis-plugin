import { KeySet, TargetIdentifiers, type VerificationMethod } from "@deep-spec-analysis/kernel-domain";
import { ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";

// 機械成分・イベント義務・初期化可能シナリオを保持する検証計画。
// 判定の意味は機械結果、義務、シナリオが所有する。計画は実行順と
// 既にskipされた対象の再評価抑止を調整する。

import type { ObligationIdentifiers } from "./obligation-identifiers.ts";
import type { QuintMachineComponents } from "./quint-machine-components.ts";
import type { QuintRuns } from "./quint-runs.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { ScenarioIdentifier } from "./scenario-identifier.ts";
import type { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import type { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationSkips } from "./verification-skips.ts";

export class QuintMachinePlan {
  readonly #invariantComponents: QuintMachineComponents;
  readonly #eventIds: ObligationIdentifiers;
  readonly #scenariosWithInit: KeySet<ScenarioIdentifier>;

  private constructor(props: {
    invariantComponents: QuintMachineComponents;
    eventIds: ObligationIdentifiers;
    scenariosWithInit: KeySet<ScenarioIdentifier>;
  }) {
    this.#invariantComponents = props.invariantComponents;
    this.#eventIds = props.eventIds;
    this.#scenariosWithInit = props.scenariosWithInit;
  }

  static of(seed: {
    readonly invariantComponents: QuintMachineComponents;
    readonly eventIds: ObligationIdentifiers;
    readonly scenariosWithInit: readonly ScenarioIdentifier[];
  }): QuintMachinePlan {
    return new QuintMachinePlan({
      invariantComponents: seed.invariantComponents,
      eventIds: seed.eventIds,
      scenariosWithInit: KeySet.of(seed.scenariosWithInit),
    });
  }

  // 機械フェーズが検査する対象の全 id（成分 + イベント義務、正準順・一意）。
  machineTargets(): TargetIdentifiers {
    return TargetIdentifiers.of([
      ...this.#invariantComponents.ids().toTargetIds(),
      ...this.#eventIds.toTargetIds(),
    ]).sortedUniqueCanonically();
  }

  // 全属性が束縛され init アクションが emit されたシナリオか。
  #hasInitFor(id: ScenarioIdentifier): boolean {
    return this.#scenariosWithInit.has(id);
  }

  interpret(
    model: RequirementsModel,
    compileSkips: VerificationSkips,
    method: VerificationMethod,
    runs: QuintRuns,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...compileSkips];
    const collect = (evidence: { findings: VerificationFindings; skipped: VerificationSkips }): void => {
      findings.push(...evidence.findings);
      skipped.push(...evidence.skipped);
    };
    const machine = runs.machineRun().interpret(model, this.#invariantComponents, this.#eventIds, method);
    if (!machine.ok) return machine;
    collect(machine.value);
    for (const obligation of model.obligations()) {
      if (!skipped.some((skip) => skip.isFor(obligation.id().asTargetId()))) {
        const temporal = obligation.interpretQuintTemporal(method, runs.temporalOf(obligation.id()));
        if (!temporal.ok) return temporal;
        collect(temporal.value);
      }
    }
    for (const scenario of model.scenarios()) {
      const interpreted = scenario.interpretQuint(
        model,
        runs.scenarioOf(scenario.id()),
        this.#hasInitFor(scenario.id()),
        this.#invariantComponents,
      );
      if (!interpreted.ok) return interpreted;
      collect(interpreted.value);
    }
    return ok({ findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) });
  }
}
