// map 検査と被覆分類 — ソルバ不要の決定論部。閉包規則：要件の全義務・全
// シナリオ・全属性は「写像済み／waive 済み／unmapped[] 記載」のどれかで、
// それ以外は mapping-gap（沈黙は契約違反）。gap 文言・witness（map 成果物への
// refs）は golden 凍結。旧 refinement-lib の planUnitRefinement / exprRefs /
// designEnumValues からの逐語移植。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type { DesignFinding, DesignMachine, DesignUnit, DesignValue } from "../../design/domain/index.ts";
import type { AlphaContext } from "./alpha-substitution.ts";
import type { AttributeMapping, RefinementUnitMap } from "./refinement-map.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

export type RefinementStatus =
  | { kind: "checkable" }
  | { kind: "waived"; reason: string }
  | { kind: "gap"; detail: string }
  | { kind: "capability"; detail: string };

export interface UnitRefinementPlan {
  ctx: AlphaContext;
  obligationStatus: Map<string, RefinementStatus>;
  scenarioStatus: Map<string, RefinementStatus>;
  eventTransitions: Map<string, string[]>; // 要件 OB id → 写像済み設計 id 列
  gaps: DesignFinding[];
}

function exprRefs(e: Expression, out: Set<string>): void {
  if (e.op === "ref" && typeof e.path === "string") out.add(e.path);
  for (const a of e.args ?? []) exprRefs(a, out);
}

function isRecord(v: DesignValue): v is { [k: string]: DesignValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// 設計属性の enum 宣言値。null は「属性が見つからない／enum でない」の区別
// （空配列と混ぜない——gap 文言の分岐が異なる）。
export function designEnumValues(u: DesignUnit, attrPath: string): string[] | null {
  const rawEntities = u.rawEntities();
  if (!Array.isArray(rawEntities)) return null;
  for (const ent of rawEntities) {
    if (!isRecord(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isRecord(attr) || typeof attr.name !== "string" || !isRecord(attr.type)) continue;
      if (`${ent.name}.${attr.name}` !== attrPath) continue;
      if (attr.type.kind !== "enum") return null;
      const values = attr.type.values;
      return Array.isArray(values) ? (values.filter((v): v is string => typeof v === "string") as string[]) : null;
    }
  }
  return null;
}

export function planUnitRefinement(
  u: DesignUnit,
  unitMap: RefinementUnitMap,
  req: RefinementRequirements,
  mapArtifact: string,
): UnitRefinementPlan {
  const gaps: DesignFinding[] = [];
  const gap = (targets: string[], detail: string, frRefs: string[] = []): void => {
    gaps.push({
      kind: "mapping-gap",
      frRefs: sortedUnique(frRefs, idCompare),
      targets: sortedUnique(targets, idCompare),
      witness: { refs: [{ artifact: mapArtifact, element: `units[${unitMap.unit}]` }] },
      unit: u.name(),
      detail,
    });
  };
  const reqAttrByPath = new Map(req.attributes().map((a) => [a.path, a]));
  const byReq = new Map<string, AttributeMapping>();
  const unmappedTargets = new Set(unitMap.unmapped.map((x) => x.target));
  const unmappedReason = new Map(unitMap.unmapped.map((x) => [x.target, x.reason] as const));

  for (const m of unitMap.attrMap) {
    if (byReq.has(m.req)) gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap maps "${m.req}" more than once`);
    byReq.set(m.req, m);
    const reqAttr = reqAttrByPath.get(m.req);
    if (!reqAttr) {
      gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap entry "${m.req}" names no attribute of the requirements IR`);
      continue;
    }
    if (m.kind === "enum-cases") {
      if (reqAttr.kind !== "enum") {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap entry "${m.req}" uses enumMap but the requirements attribute is ${reqAttr.kind}`);
      }
      if (!u.attrPaths().has(m.from)) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap.from "${m.from}" is not a design attribute of unit ${u.name()}`);
        continue;
      }
      const fromValues = designEnumValues(u, m.from);
      if (fromValues === null) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap.from "${m.from}" is not an enum design attribute`);
        continue;
      }
      const missing = fromValues.filter((v) => !(v in m.cases)).sort();
      if (missing.length > 0) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap for "${m.req}" is not total over "${m.from}": missing case(s) ${missing.join(", ")}`);
      }
      const badResults = sortedUnique(Object.values(m.cases).filter((rv) => !(reqAttr.values ?? []).includes(rv)), idCompare);
      if (badResults.length > 0) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap for "${m.req}" produces value(s) ${badResults.join(", ")} outside the requirements attribute's values`);
      }
    } else if (m.kind === "expression") {
      const refs = new Set<string>();
      exprRefs(m.expr, refs);
      for (const r of [...refs].sort()) {
        if (!u.attrPaths().has(r)) {
          gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap expression for "${m.req}" references "${r}", which is not a design attribute of unit ${u.name()}`);
        }
      }
    }
  }

  // 属性の閉包：要件の全属性は写像されるか unmapped[] に居る。
  for (const a of [...req.attributes()].sort((x, y) => (x.path < y.path ? -1 : 1))) {
    if (!byReq.has(a.path) && !unmappedTargets.has(a.path)) {
      gap(
        [`attr:${a.path.replace(/[^A-Za-z0-9_./-]/g, "-")}`],
        `requirements attribute "${a.path}" is neither mapped by attrMap nor listed in unmapped[] — silence is a contract violation`,
      );
    }
  }

  const ctx: AlphaContext = { byReq, reqAttrByPath };
  const eventByTrigger = new Map(unitMap.eventMap.map((e) => [e.reqTrigger, e] as const));
  const designIds = new Set<string>([
    ...u.obligations().map((o) => o.id),
    ...u.machines().flatMap((m: DesignMachine) => m.transitions.map((t) => t.id)),
  ]);

  const attrsCovered = (e: Expression | undefined): { ok: boolean; missing: string[] } => {
    if (!e) return { ok: true, missing: [] };
    const refs = new Set<string>();
    exprRefs(e, refs);
    const missing = [...refs].filter((r) => !byReq.has(r)).sort();
    return { ok: missing.length === 0, missing };
  };

  const obligationStatus = new Map<string, RefinementStatus>();
  const eventTransitions = new Map<string, string[]>();
  for (const ob of req.obligations()) {
    if (unmappedTargets.has(ob.id)) {
      obligationStatus.set(ob.id, { kind: "waived", reason: unmappedReason.get(ob.id) ?? "listed in unmapped[]" });
      continue;
    }
    if (ob.nature === "state-temporal") {
      obligationStatus.set(ob.id, { kind: "capability", detail: "temporal refinement is outside v1 scope" });
      continue;
    }
    if (ob.nature === "invariant" || ob.nature === "numeric") {
      const cov = attrsCovered(ob.assert);
      if (cov.ok) obligationStatus.set(ob.id, { kind: "checkable" });
      else if (cov.missing.every((m) => unmappedTargets.has(m))) {
        obligationStatus.set(ob.id, { kind: "waived", reason: `depends on unmapped attribute(s) ${cov.missing.join(", ")}` });
      } else {
        obligationStatus.set(ob.id, { kind: "gap", detail: `depends on attribute(s) ${cov.missing.join(", ")} that are neither mapped nor in unmapped[]` });
      }
      continue;
    }
    if (ob.nature === "event") {
      const entry = ob.trigger === undefined ? undefined : eventByTrigger.get(ob.trigger);
      if (entry?.waived) {
        obligationStatus.set(ob.id, { kind: "waived", reason: entry.waived.reason });
        continue;
      }
      const covG = attrsCovered(ob.guard);
      const covE = attrsCovered(ob.effect);
      const missing = sortedUnique([...covG.missing, ...covE.missing], idCompare);
      if (!entry || entry.transitions.length === 0) {
        obligationStatus.set(ob.id, { kind: "gap", detail: `requirements event trigger "${ob.trigger ?? "?"}" has no eventMap entry (map it to design transitions or waive it)` });
        continue;
      }
      const badIds = entry.transitions.filter((t) => !designIds.has(t)).sort();
      if (badIds.length > 0) {
        obligationStatus.set(ob.id, { kind: "gap", detail: `eventMap for "${ob.trigger}" names unknown design id(s) ${badIds.join(", ")}` });
        continue;
      }
      if (missing.length > 0) {
        if (missing.every((m) => unmappedTargets.has(m))) {
          obligationStatus.set(ob.id, { kind: "waived", reason: `depends on unmapped attribute(s) ${missing.join(", ")}` });
        } else {
          obligationStatus.set(ob.id, { kind: "gap", detail: `depends on attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]` });
        }
        continue;
      }
      obligationStatus.set(ob.id, { kind: "checkable" });
      eventTransitions.set(ob.id, [...entry.transitions].sort(idCompare));
      continue;
    }
    obligationStatus.set(ob.id, { kind: "capability", detail: `nature "${ob.nature}" has no refinement check` });
  }

  const scenarioStatus = new Map<string, RefinementStatus>();
  for (const sc of req.scenarios()) {
    if (unmappedTargets.has(sc.id)) {
      scenarioStatus.set(sc.id, { kind: "waived", reason: unmappedReason.get(sc.id) ?? "listed in unmapped[]" });
      continue;
    }
    if (sc.event) {
      scenarioStatus.set(sc.id, { kind: "capability", detail: "event scenarios are not replayed in v1" });
      continue;
    }
    const missing = Object.keys(sc.bindings)
      .filter((p) => !byReq.has(p))
      .sort();
    if (missing.length === 0) scenarioStatus.set(sc.id, { kind: "checkable" });
    else if (missing.every((m) => unmappedTargets.has(m))) {
      scenarioStatus.set(sc.id, { kind: "waived", reason: `binds unmapped attribute(s) ${missing.join(", ")}` });
    } else {
      scenarioStatus.set(sc.id, { kind: "gap", detail: `binds attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]` });
    }
  }

  // 義務/シナリオの gap 分類は mapping-gap finding へ昇格する。
  for (const [id, st] of [...obligationStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "gap") {
      gap([id], `${id}: ${st.detail}`, req.obligationById(id)?.frRefs ?? []);
    }
  }
  for (const [id, st] of [...scenarioStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "gap") {
      gap([id], `${id}: ${st.detail}`, req.scenarioById(id)?.frRefs ?? []);
    }
  }

  return { ctx, obligationStatus, scenarioStatus, eventTransitions, gaps };
}
