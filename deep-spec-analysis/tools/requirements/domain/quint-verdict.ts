// Quint 実行 1 フェーズ分の型付き判定。CLI 出力・ITF という形式はアダプタが
// decode 済みで渡す。outputTail は CLI の生出力尾（材料）で、凍結 detail 文言に
// 逐語で載る。フェーズ横断の判定面（機械・時相・シナリオ）は QuintRuns が
// クラスとして持ち、露出 Map は死んだ。

import { TraceStates } from "./trace-state.ts";

export type QuintMachineRunVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "deadlock"; readonly trace: TraceStates | null }
  | { readonly kind: "violation"; readonly trace: TraceStates }
  | { readonly kind: "run-failed"; readonly outputTail: string }
  | { readonly kind: "clean" };

export type QuintTemporalVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "violation"; readonly trace: TraceStates }
  | { readonly kind: "clean" };

export type QuintScenarioVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "run-failed"; readonly outputTail: string }
  | { readonly kind: "evaluated"; readonly violated: boolean };

export interface QuintRunsSeed {
  readonly machine: QuintMachineRunVerdict | null;
  readonly temporals: ReadonlyMap<string, QuintTemporalVerdict>;
  readonly scenarios: ReadonlyMap<string, QuintScenarioVerdict>;
}

export class QuintRuns {
  readonly #machine: QuintMachineRunVerdict | null;
  readonly #temporals: ReadonlyMap<string, QuintTemporalVerdict>;
  readonly #scenarios: ReadonlyMap<string, QuintScenarioVerdict>;

  private constructor(seed: QuintRunsSeed) {
    this.#machine = seed.machine;
    this.#temporals = seed.temporals;
    this.#scenarios = seed.scenarios;
  }

  static of(seed: QuintRunsSeed): QuintRuns {
    return new QuintRuns({
      machine: seed.machine,
      temporals: new Map(seed.temporals),
      scenarios: new Map(seed.scenarios),
    });
  }

  machineRun(): QuintMachineRunVerdict | null {
    return this.#machine;
  }

  temporalOf(obligationId: string): QuintTemporalVerdict | undefined {
    return this.#temporals.get(obligationId);
  }

  scenarioOf(scenarioId: string): QuintScenarioVerdict | undefined {
    return this.#scenarios.get(scenarioId);
  }
}
