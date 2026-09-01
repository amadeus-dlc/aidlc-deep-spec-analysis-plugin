import type { Expression, FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import type { ObligationId, ObligationNature } from "../../requirements/domain/index.ts";

export interface RefinementObligation {
  id: ObligationId;
  nature: ObligationNature;
  frRefs: FrRefs;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
}
