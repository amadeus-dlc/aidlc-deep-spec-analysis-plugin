import type { Expression, FrRefs } from "../../kernel/domain/index.ts";
import type { ObligationId } from "../../requirements/domain/index.ts";

export interface RefinementQuintInvariant {
  reqId: ObligationId;
  frRefs: FrRefs;
  expr: Expression;
}
