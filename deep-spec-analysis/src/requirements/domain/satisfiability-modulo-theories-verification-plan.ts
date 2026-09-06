import type {
  KeyedIndex,
  KeySet,
  QueryLabel,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import { SatisfiabilityModuloTheoriesProbe } from "./satisfiability-modulo-theories-probe.ts";

// コンパイルされた問いと対象の対応を保持する検証計画。
// 問いが返す診断を集め、大域矛盾から派生する診断の抑止と重複排除を調整する。

import type { ObligationIdentifier } from "./obligation-identifier.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SatisfiabilityModuloTheoriesEventPairProbes } from "./satisfiability-modulo-theories-event-pair-probes.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";
import type { ScenarioIdentifier } from "./scenario-identifier.ts";
import type { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import type { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationSkips } from "./verification-skips.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SatisfiabilityModuloTheoriesVerificationPlanParam = {
  readonly compiled: KeySet<ObligationIdentifier>;
  readonly vacuityQueries: KeyedIndex<ObligationIdentifier, QueryLabel>;
  readonly skipped: VerificationSkips;
  readonly labelToTarget: KeyedIndex<QueryLabel, TargetIdentifier>;
  readonly eventPairs: SatisfiabilityModuloTheoriesEventPairProbes;
  readonly gapTriggers: KeyedIndex<TriggerName, TargetIdentifiers>;
  readonly scenarioQueries: KeyedIndex<ScenarioIdentifier, QueryLabel>;
};

export class SatisfiabilityModuloTheoriesVerificationPlan {
  readonly #compiled: KeySet<ObligationIdentifier>;
  readonly #vacuityQueries: KeyedIndex<ObligationIdentifier, QueryLabel>;
  readonly #skipped: VerificationSkips;
  readonly #labelToTarget: KeyedIndex<QueryLabel, TargetIdentifier>;
  readonly #eventPairs: SatisfiabilityModuloTheoriesEventPairProbes;
  readonly #gapTriggers: KeyedIndex<TriggerName, TargetIdentifiers>;
  readonly #scenarioQueries: KeyedIndex<ScenarioIdentifier, QueryLabel>;

  private constructor(seed: SatisfiabilityModuloTheoriesVerificationPlanParam) {
    this.#compiled = seed.compiled;
    this.#vacuityQueries = seed.vacuityQueries;
    this.#skipped = seed.skipped;
    this.#labelToTarget = seed.labelToTarget;
    this.#eventPairs = seed.eventPairs;
    this.#gapTriggers = seed.gapTriggers;
    this.#scenarioQueries = seed.scenarioQueries;
  }

  static of(seed: SatisfiabilityModuloTheoriesVerificationPlanParam): SatisfiabilityModuloTheoriesVerificationPlan {
    return new SatisfiabilityModuloTheoriesVerificationPlan(seed);
  }

  // ソルバ実行不能でも文書に載るコンパイル時 skip（unavailable 文書用）。
  planSkipped(): VerificationSkips {
    return this.#skipped;
  }

  interpret(
    model: RequirementsModel,
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
  ): { findings: VerificationFindings; skipped: VerificationSkips } {
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...this.#skipped];
    const collect = (evidence: { findings: VerificationFindings; skipped: VerificationSkips }): void => {
      findings.push(...evidence.findings);
      skipped.push(...evidence.skipped);
    };
    const consistency = SatisfiabilityModuloTheoriesProbe.consistency(
      model.obligations().compiledInvariantTargets(this.#compiled),
      this.#labelToTarget,
    );
    collect(consistency.interpret(model, results));
    if (consistency.allowsVacuityChecks(results))
      for (const [subject, query] of this.#vacuityQueries)
        collect(
          SatisfiabilityModuloTheoriesProbe.vacuity(query, subject, this.#labelToTarget).interpret(model, results),
        );
    for (const pair of this.#eventPairs) collect(pair.interpret(model, results));
    for (const [trigger, targets] of [...this.#gapTriggers].sort((a, b) =>
      a[0].asString() < b[0].asString() ? -1 : a[0].asString() > b[0].asString() ? 1 : 0,
    ))
      collect(SatisfiabilityModuloTheoriesProbe.completeness(trigger, targets).interpret(model, results));
    for (const scenario of model.scenarios()) {
      const query = this.#scenarioQueries.get(scenario.id());
      if (query !== undefined)
        collect(
          SatisfiabilityModuloTheoriesProbe.scenario(query, scenario, this.#labelToTarget).interpret(model, results),
        );
    }
    return { findings: VerificationFindings.of(findings).distinctConflicts(), skipped: VerificationSkips.of(skipped) };
  }
}
