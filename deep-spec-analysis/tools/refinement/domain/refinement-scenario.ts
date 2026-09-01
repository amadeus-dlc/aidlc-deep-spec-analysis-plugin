import type { FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import type { ScenarioId } from "../../requirements/domain/index.ts";

export interface RefinementScenario {
  id: ScenarioId;
  kind: "accept" | "reject";
  frRefs: FrRefs;
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: TriggerName };
}
