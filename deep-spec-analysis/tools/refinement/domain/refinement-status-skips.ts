// 被覆分類（waived / capability）の skip 記録 — SMT パスと Quint パスで
// 記録範囲が異なる凍結挙動：SMT は waived/capability のみ、Quint はさらに
// checkable の event 義務・シナリオを「SMT 専用検査」の capability として
// 記録する。文言はすべて golden 凍結。旧 runUnitRefinementSmt 冒頭と旧 quint
// entry の Phase 3 ステータス記録からの逐語移植。

import { idCompare } from "../../kernel/domain/index.ts";
import type { DesignSkipped } from "../../design/domain/index.ts";
import type { UnitRefinementPlan } from "./refinement-plan.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

export function smtRefinementStatusSkips(plan: UnitRefinementPlan, unitName: string): DesignSkipped[] {
  const skipped: DesignSkipped[] = [];
  const skip = (target: string, reason: string, detail: string): void => {
    skipped.push({ target, reason, unit: unitName, detail });
  };
  for (const [id, st] of [...plan.obligationStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "waived") skip(id, "waived", st.reason);
    if (st.kind === "capability") skip(id, "capability", st.detail);
  }
  for (const [id, st] of [...plan.scenarioStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "waived") skip(id, "waived", st.reason);
    if (st.kind === "capability") skip(id, "capability", st.detail);
  }
  return skipped;
}

export function quintRefinementStatusSkips(
  plan: UnitRefinementPlan,
  req: RefinementRequirements,
  unitName: string,
): DesignSkipped[] {
  const skipped: DesignSkipped[] = [];
  for (const [rid, st] of [...plan.obligationStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (st.kind === "waived") skipped.push({ target: rid, reason: "waived", unit: unitName, detail: st.reason });
    else if (st.kind === "capability") skipped.push({ target: rid, reason: "capability", unit: unitName, detail: st.detail });
    else if (st.kind === "checkable") {
      const ob = req.obligationById(rid);
      if (ob?.nature === "event") {
        skipped.push({ target: rid, reason: "capability", unit: unitName, detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" });
      }
    }
  }
  for (const [rid, st] of [...plan.scenarioStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (st.kind === "waived") skipped.push({ target: rid, reason: "waived", unit: unitName, detail: st.reason });
    else if (st.kind === "capability") skipped.push({ target: rid, reason: "capability", unit: unitName, detail: st.detail });
    else if (st.kind === "checkable") {
      skipped.push({ target: rid, reason: "capability", unit: unitName, detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" });
    }
  }
  return skipped;
}
