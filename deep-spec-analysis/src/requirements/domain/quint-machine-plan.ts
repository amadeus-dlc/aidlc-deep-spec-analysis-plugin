import { KeySet, TargetIdentifiers, type VerificationMethod } from "@deep-spec-analysis/kernel-domain";

// Quint 状態機械の計画——コンパイラが機械を組んだときの対応表で、形式
// （Quint テキスト）を含まない面（種別規律の裁定 8——値オブジェクト）。旧名
// QuintMachineFacts の「事実」はドメインイベントに取っておく。判定解釈に必要な、形式（Quint テキスト）を
// 含まない面。不変量成分（帰属評価に使う式つき）・イベント義務 id・
// 全属性が束縛された init 可能シナリオの集合がここに載る。
// モジュール本文と変数名対応はアダプタのコンパイラが所有する。判定の解釈
// （旧 interpretQuintVerdicts——detail 文言は golden 凍結・返り値は未ソートで
// 正準ソートは VerificationReport.compose の不変条件、phase 2 の「既に skip
// 済みの義務は走らせない」ガードも逐語）は plan 自身の振る舞い（OOUI 裁定）。
// 対象 id は TargetIdentifier / TargetIdentifiers で運ぶ（#71 波10——生 string の列ではない）。

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
  ): { findings: VerificationFindings; skipped: VerificationSkips } {
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...compileSkips];
    const collect = (evidence: { findings: VerificationFindings; skipped: VerificationSkips }): void => {
      findings.push(...evidence.findings);
      skipped.push(...evidence.skipped);
    };
    collect(runs.machineRun().interpret(model, this.#invariantComponents, this.#eventIds, method));
    for (const obligation of model.obligations()) {
      if (!skipped.some((skip) => skip.isFor(obligation.id().asTargetId())))
        collect(obligation.interpretQuintTemporal(method, runs.temporalOf(obligation.id())));
    }
    for (const scenario of model.scenarios())
      collect(
        scenario.interpretQuint(
          model,
          runs.scenarioOf(scenario.id()),
          this.#hasInitFor(scenario.id()),
          this.#invariantComponents,
        ),
      );
    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
