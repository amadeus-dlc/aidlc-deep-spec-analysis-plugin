import { SmtEventPairProbes } from "./smt-event-pair-probes.ts";
import { VerificationSkips } from "./verification-skips.ts";

export interface SmtPlanFactsSeed {
  readonly compiled: ReadonlyMap<string, boolean>;
  readonly skipped: VerificationSkips;
  readonly labelToTarget: ReadonlyMap<string, string>;
  readonly eventPairs: SmtEventPairProbes;
  readonly gapTriggers: ReadonlyMap<string, readonly string[]>;
  readonly scenarioQueries: ReadonlyMap<string, string>;
}
