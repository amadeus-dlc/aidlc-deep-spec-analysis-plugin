// Quint 側の refinement 追加不変量 — checkable な invariant/numeric 要件義務
// ごとの alpha(P)。ユニットの lowering に追加不変量として合流し、違反成分が
// これのトレースは「到達可能な refinement 破れ」になる。旧
// refinementQuintInvariants の逐語移植。

import { idCompare } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import { alphaExpr } from "./alpha-substitution.ts";
import type { UnitRefinementPlan } from "./refinement-plan.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

export interface RefinementQuintInvariant {
  reqId: string;
  frRefs: string[];
  expr: Expression;
}

export function refinementQuintInvariants(plan: UnitRefinementPlan, req: RefinementRequirements): RefinementQuintInvariant[] {
  const out: RefinementQuintInvariant[] = [];
  for (const ob of [...req.obligations()].sort((a, b) => idCompare(a.id, b.id))) {
    if (plan.obligationStatus.get(ob.id)?.kind !== "checkable") continue;
    if ((ob.nature !== "invariant" && ob.nature !== "numeric") || !ob.assert) continue;
    try {
      out.push({ reqId: ob.id, frRefs: ob.frRefs, expr: alphaExpr(plan.ctx, ob.assert, false) });
    } catch {
      // SMT パスが compile-error skip として報告する。
    }
  }
  return out;
}
