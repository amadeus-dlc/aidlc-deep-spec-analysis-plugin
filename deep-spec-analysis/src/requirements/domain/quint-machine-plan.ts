import { KeySet, type TargetIdentifiers, type VerificationMethod } from "@deep-spec-analysis/kernel-domain";
import { ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";

// 機械成分・イベント義務・初期化可能シナリオを保持する検証計画。
// 判定の意味は機械結果、義務、シナリオが所有する。計画は実行順と
// 既にskipされた対象の再評価抑止を調整する。

import type { ObligationIdentifiers } from "./obligation-identifiers.ts";
import type { QuintMachineComponents } from "./quint-machine-components.ts";
import type { QuintRuns } from "./quint-runs.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { ScenarioIdentifier } from "./scenario-identifier.ts";
import type { VerificationFindings } from "./verification-findings.ts";
import type { VerificationSkips } from "./verification-skips.ts";

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
    return this.#invariantComponents
      .ids()
      .toTargetIds()
      .combine(this.#eventIds.toTargetIds())
      .sortedUniqueCanonically();
  }

  interpret(
    model: RequirementsModel,
    compileSkips: VerificationSkips,
    method: VerificationMethod,
    runs: QuintRuns,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const machine = runs.machineRun().interpret(model, this.#invariantComponents, this.#eventIds, method);
    if (!machine.ok) return machine;
    // 時相フェーズはコンパイル時 skip と機械フェーズの skip を引き継ぎ、
    // 既に skip された義務を再評価しない。
    const temporal = model
      .obligations()
      .interpretQuintTemporal(method, runs, compileSkips.combine(machine.value.skipped));
    if (!temporal.ok) return temporal;
    const scenarios = model.scenarios().interpretQuint(model, runs, this.#scenariosWithInit, this.#invariantComponents);
    if (!scenarios.ok) return scenarios;
    return ok({
      findings: machine.value.findings.combine(temporal.value.findings).combine(scenarios.value.findings),
      skipped: temporal.value.skipped.combine(scenarios.value.skipped),
    });
  }
}
