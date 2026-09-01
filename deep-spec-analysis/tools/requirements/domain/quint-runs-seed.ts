import type { QuintMachineRunVerdict } from "./quint-machine-run-verdict.ts";
import type { QuintScenarioVerdict } from "./quint-scenario-verdict.ts";
import type { QuintTemporalVerdict } from "./quint-temporal-verdict.ts";

export interface QuintRunsSeed {
  readonly machine: QuintMachineRunVerdict | null;
  readonly temporals: ReadonlyMap<string, QuintTemporalVerdict>;
  readonly scenarios: ReadonlyMap<string, QuintScenarioVerdict>;
}
