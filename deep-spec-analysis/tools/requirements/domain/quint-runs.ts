// Quint 実行 1 フェーズ分の型付き判定。CLI 出力・ITF という形式はアダプタが
// decode 済みで渡す。outputTail は CLI の生出力尾（材料）で、凍結 detail 文言に
// 逐語で載る。フェーズ横断の判定面（機械・時相・シナリオ）は QuintRuns が
// クラスとして持ち、露出 Map は死んだ。

import type { ObligationId } from "./obligation-id.ts";
import type { QuintMachineRunVerdict } from "./quint-machine-run-verdict.ts";
import type { ScenarioId } from "./scenario-id.ts";
import type { QuintScenarioVerdict } from "./quint-scenario-verdict.ts";
import type { QuintTemporalVerdict } from "./quint-temporal-verdict.ts";
import { KeyedIndex } from "../../kernel/domain/index.ts";

export class QuintRuns {
  readonly #machine: QuintMachineRunVerdict | null;
  readonly #temporals: KeyedIndex<ObligationId, QuintTemporalVerdict>;
  readonly #scenarios: KeyedIndex<ScenarioId, QuintScenarioVerdict>;

  private constructor(seed: {
    readonly machine: QuintMachineRunVerdict | null;
    readonly temporals: KeyedIndex<ObligationId, QuintTemporalVerdict>;
    readonly scenarios: KeyedIndex<ScenarioId, QuintScenarioVerdict>;
  }) {
    this.#machine = seed.machine;
    this.#temporals = seed.temporals;
    this.#scenarios = seed.scenarios;
  }

  static of(seed: {
    readonly machine: QuintMachineRunVerdict | null;
    readonly temporals: KeyedIndex<ObligationId, QuintTemporalVerdict>;
    readonly scenarios: KeyedIndex<ScenarioId, QuintScenarioVerdict>;
  }): QuintRuns {
    return new QuintRuns({
      machine: seed.machine,
      temporals: seed.temporals,
      scenarios: seed.scenarios,
    });
  }

  machineRun(): QuintMachineRunVerdict | null {
    return this.#machine;
  }

  temporalOf(obligationId: ObligationId): QuintTemporalVerdict | undefined {
    return this.#temporals.get(obligationId);
  }

  scenarioOf(scenarioId: ScenarioId): QuintScenarioVerdict | undefined {
    return this.#scenarios.get(scenarioId);
  }
}
