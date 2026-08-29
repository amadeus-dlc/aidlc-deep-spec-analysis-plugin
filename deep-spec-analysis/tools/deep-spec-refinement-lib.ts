// Refinement machinery for phase 3 of the design-verification extension:
// checking that the design still MEANS what the verified requirements meant,
// under an explicit, human-gated abstraction function (contract 4).
//
// Direction: standard data refinement. The map defines every REQUIREMENTS
// attribute as an expression over DESIGN attributes (alpha), so substituting
// the map into a requirements property is purely mechanical:
//
//   refinement-violation (static)  — sat(designLegal ∧ ¬alpha(P)): a
//                                    design-legal state that violates the
//                                    requirement (may be machine-unreachable
//                                    — the same deliberate over-report
//                                    philosophy as v1's completeness gap);
//   refinement-violation (dynamic) — alpha(P) joins the design machine's
//                                    invariant surface in the Quint backend:
//                                    a violation trace is a REACHABLE break;
//   event simulation (safety)      — a design step of a mapped transition,
//                                    taken where alpha(guard) holds, whose
//                                    abstract post-state violates the
//                                    requirements effect or the abstract
//                                    frame (unassigned requirements
//                                    attributes must keep their abstract
//                                    value — the Q2 resolution);
//   enabledness                    — a design-legal state where the
//                                    requirements event applies but no
//                                    mapped transition is enabled;
//   scenario replay (SMT only)     — requirements bindings imposed as
//                                    alpha-constraints over design state.
//
// SMT queries are executed by the PROVEN v1 z3 child (--smt-child of the v1
// SMT sensor): this library only builds SMT-LIB scripts — the runtime
// fallback, budgets, and model/core decoding protocol stay v1's. Map
// validation itself is deterministic and solver-free (mapping-gap findings;
// the closure rule: every requirements obligation/scenario/attribute is
// mapped, waived, or in unmapped[] — anything else is a gap).
//
// PLUGIN-INTERNAL library, shipped in the same compose delta.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Json,
  canonicalStringify,
  idCompare,
  isObject,
  sha256,
  sortedUnique,
  validateSchema,
} from "./kernel/domain/index.ts";
import {
  type DFinding,
  type DSkipped,
  type DesignMachine,
  type DesignUnit,
  type Expr,
  extractSingleJsonFence,
} from "./deep-spec-design-lib.ts";

export const REFINEMENT_MAP_BASENAME = "deep-spec-analysis-refinement-map.md";
export const REQUIREMENTS_MODEL_RELPATH = ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"];
const PER_QUERY_TIMEOUT_MS = Number(process.env.AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS) || 2000;
const CHILD_BUDGET_MS = 30_000;

// --- requirements IR (contract 1) loading ------------------------------------

export interface ReqAttr {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
}

export interface ReqObligation {
  id: string;
  nature: string;
  frRefs: string[];
  assert?: Expr;
  trigger?: string;
  guard?: Expr;
  effect?: Expr;
}

export interface ReqScenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
}

export interface ReqIr {
  hash: string;
  attrs: ReqAttr[];
  obligations: ReqObligation[];
  scenarios: ReqScenario[];
}

const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);

export function loadRequirementsIr(recordRoot: string): ReqIr | null {
  const path = join(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
  if (!existsSync(path)) return null;
  const fence = extractSingleJsonFence(readFileSync(path, "utf-8"));
  if (fence === null) return null;
  let raw: Json;
  try {
    raw = JSON.parse(fence) as Json;
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;
  const attrs: ReqAttr[] = [];
  const schema = isObject(raw.schema) ? raw.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
      const t = attr.type;
      if (t.kind !== "bool" && t.kind !== "int" && t.kind !== "enum") continue;
      attrs.push({
        path: `${ent.name}.${attr.name}`,
        kind: t.kind,
        min: typeof t.min === "number" ? t.min : undefined,
        max: typeof t.max === "number" ? t.max : undefined,
        values: Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined,
      });
    }
  }
  const obligations: ReqObligation[] = [];
  for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
    obligations.push({
      id: ob.id,
      nature: ob.nature,
      frRefs: strArr(ob.frRefs),
      assert: isObject(ob.assert) ? (ob.assert as unknown as Expr) : undefined,
      trigger: typeof ob.trigger === "string" ? ob.trigger : undefined,
      guard: isObject(ob.guard) ? (ob.guard as unknown as Expr) : undefined,
      effect: isObject(ob.effect) ? (ob.effect as unknown as Expr) : undefined,
    });
  }
  const scenarios: ReqScenario[] = [];
  for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string" || !isObject(sc.bindings)) continue;
    if (sc.kind !== "accept" && sc.kind !== "reject") continue;
    const bindings: ReqScenario["bindings"] = {};
    for (const [k, v] of Object.entries(sc.bindings)) {
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
    }
    scenarios.push({
      id: sc.id,
      kind: sc.kind,
      frRefs: strArr(sc.frRefs),
      bindings,
      event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: sc.event.trigger } : undefined,
    });
  }
  return { hash: sha256(canonicalStringify(raw)), attrs, obligations, scenarios };
}

// --- refinement map (contract 4) loading and validation ----------------------

export interface AttrMapping {
  req: string;
  expr?: Expr;
  enumMap?: { from: string; cases: { [designValue: string]: string } };
}

export interface UnitMap {
  unit: string;
  attrMap: AttrMapping[];
  eventMap: { reqTrigger: string; transitions: string[]; waived?: { reason: string } }[];
  unmapped: { target: string; reason: string }[];
}

export interface RefMap {
  requirementsIrHash: string;
  designIrHash: string;
  units: UnitMap[];
}

export function loadRefinementMap(stageDir: string): { map: RefMap | null; error: string | null } {
  const path = join(stageDir, REFINEMENT_MAP_BASENAME);
  if (!existsSync(path)) return { map: null, error: null };
  const fence = extractSingleJsonFence(readFileSync(path, "utf-8"));
  if (fence === null) return { map: null, error: "refinement map does not contain exactly one ```json fence" };
  let raw: Json;
  try {
    raw = JSON.parse(fence) as Json;
  } catch (err) {
    return { map: null, error: `refinement map fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  try {
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-refinement-map-schema.json");
    const schemaDoc = JSON.parse(readFileSync(schemaPath, "utf-8"));
    const errors: string[] = [];
    validateSchema(schemaDoc as never, schemaDoc as never, raw as never, "", errors);
    if (errors.length > 0) return { map: null, error: `refinement map does not conform to contract 4: ${errors[0]}` };
  } catch (err) {
    return { map: null, error: `refinement map schema unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  const doc = raw as { [k: string]: Json };
  const units: UnitMap[] = [];
  for (const u of Array.isArray(doc.units) ? doc.units : []) {
    if (!isObject(u) || typeof u.unit !== "string") continue;
    const attrMap: AttrMapping[] = [];
    for (const m of Array.isArray(u.attrMap) ? u.attrMap : []) {
      if (!isObject(m) || typeof m.req !== "string") continue;
      const entry: AttrMapping = { req: m.req };
      if (isObject(m.expr)) entry.expr = m.expr as unknown as Expr;
      if (isObject(m.enumMap) && typeof m.enumMap.from === "string" && isObject(m.enumMap.cases)) {
        const cases: { [k: string]: string } = {};
        for (const [k, v] of Object.entries(m.enumMap.cases)) {
          if (typeof v === "string") cases[k] = v;
        }
        entry.enumMap = { from: m.enumMap.from, cases };
      }
      attrMap.push(entry);
    }
    const eventMap: UnitMap["eventMap"] = [];
    for (const e of Array.isArray(u.eventMap) ? u.eventMap : []) {
      if (!isObject(e) || typeof e.reqTrigger !== "string") continue;
      eventMap.push({
        reqTrigger: e.reqTrigger,
        transitions: strArr(e.transitions),
        waived: isObject(e.waived) && typeof e.waived.reason === "string" ? { reason: e.waived.reason } : undefined,
      });
    }
    const unmapped: UnitMap["unmapped"] = [];
    for (const un of Array.isArray(u.unmapped) ? u.unmapped : []) {
      if (isObject(un) && typeof un.target === "string") {
        unmapped.push({ target: un.target, reason: typeof un.reason === "string" ? un.reason : "" });
      }
    }
    units.push({ unit: u.unit, attrMap, eventMap, unmapped });
  }
  return {
    map: {
      requirementsIrHash: typeof doc.requirementsIrHash === "string" ? doc.requirementsIrHash : "",
      designIrHash: typeof doc.designIrHash === "string" ? doc.designIrHash : "",
      units,
    },
    error: null,
  };
}

// --- alpha substitution ------------------------------------------------------

class AlphaError extends Error {}

interface AlphaCtx {
  byReq: Map<string, AttrMapping>;
  reqAttrByPath: Map<string, ReqAttr>;
}

function primeAll(e: Expr): Expr {
  if (e.op === "ref") return { ...e, prime: true };
  return { ...e, args: (e.args ?? []).map(primeAll) };
}

// alpha(expr): rewrite a requirements expression into a design expression.
// bool/int attributes substitute their mapping expression; enum attributes
// (enumMap) are only legal inside eq/ne against an enum literal, where the
// comparison expands to a disjunction over the design values that map to it.
export function alphaExpr(ctx: AlphaCtx, e: Expr, post: boolean): Expr {
  if (e.op === "eq" || e.op === "ne") {
    const [a, b] = e.args ?? [];
    const refArg = a?.op === "ref" ? a : b?.op === "ref" ? b : null;
    const enumArg = a?.op === "enum" ? a : b?.op === "enum" ? b : null;
    if (refArg && enumArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const mapping = ctx.byReq.get(refArg.path);
      if (mapping?.enumMap) {
        const usePost = post || refArg.prime === true;
        const from: Expr = { op: "ref", path: mapping.enumMap.from, ...(usePost ? { prime: true } : {}) };
        const matching = Object.entries(mapping.enumMap.cases)
          .filter(([, reqValue]) => reqValue === enumArg.value)
          .map(([designValue]) => designValue)
          .sort();
        const disjunction: Expr =
          matching.length === 0
            ? { op: "bool", value: false }
            : matching.length === 1
              ? { op: "eq", args: [from, { op: "enum", value: matching[0] as string }] }
              : { op: "or", args: matching.map((d) => ({ op: "eq", args: [from, { op: "enum", value: d }] }) as Expr) };
        return e.op === "eq" ? disjunction : { op: "not", args: [disjunction] };
      }
    }
  }
  if (e.op === "ref" && typeof e.path === "string") {
    const mapping = ctx.byReq.get(e.path);
    if (!mapping) throw new AlphaError(`requirements attribute "${e.path}" is not covered by the attrMap`);
    if (mapping.enumMap) {
      throw new AlphaError(`enum-mapped requirements attribute "${e.path}" is only legal inside eq/ne against an enum literal`);
    }
    const substituted = mapping.expr as Expr;
    return post || e.prime === true ? primeAll(substituted) : substituted;
  }
  if (e.args) return { ...e, args: e.args.map((a) => alphaExpr(ctx, a, post)) };
  return e;
}

export function alphaEquality(ctx: AlphaCtx, reqPath: string): Expr | null {
  // alpha(a)(pre) == alpha(a)(post), used for the abstract frame (Q2).
  const mapping = ctx.byReq.get(reqPath);
  if (!mapping) return null;
  if (mapping.enumMap) {
    const pre: Expr = { op: "ref", path: mapping.enumMap.from };
    const values = sortedUnique(Object.values(mapping.enumMap.cases), idCompare);
    // Two design values abstract equally iff they map to the same req value:
    // for each req value, pre-in-class iff post-in-class.
    const classes = values.map((reqValue) => {
      const members = Object.entries(mapping.enumMap?.cases ?? {})
        .filter(([, rv]) => rv === reqValue)
        .map(([d]) => d)
        .sort();
      const inClass = (primed: boolean): Expr => {
        const refNode: Expr = { op: "ref", path: (mapping.enumMap as { from: string }).from, ...(primed ? { prime: true } : {}) };
        const eqs = members.map((d) => ({ op: "eq", args: [refNode, { op: "enum", value: d }] }) as Expr);
        return eqs.length === 1 ? (eqs[0] as Expr) : { op: "or", args: eqs };
      };
      return { op: "iff", args: [inClass(false), inClass(true)] } as Expr;
    });
    void pre;
    return classes.length === 1 ? (classes[0] as Expr) : { op: "and", args: classes };
  }
  const preE = mapping.expr as Expr;
  return { op: "eq", args: [preE, primeAll(preE)] };
}

// --- map validation + coverage classification --------------------------------

export type RefStatus =
  | { kind: "checkable" }
  | { kind: "waived"; reason: string }
  | { kind: "gap"; detail: string }
  | { kind: "capability"; detail: string };

export interface UnitRefPlan {
  ctx: AlphaCtx;
  obligationStatus: Map<string, RefStatus>;
  scenarioStatus: Map<string, RefStatus>;
  eventTransitions: Map<string, string[]>; // req OB id -> mapped design ids
  gaps: DFinding[];
}

function exprRefs(e: Expr, out: Set<string>): void {
  if (e.op === "ref" && typeof e.path === "string") out.add(e.path);
  for (const a of e.args ?? []) exprRefs(a, out);
}

export function planUnitRefinement(u: DesignUnit, unitMap: UnitMap, req: ReqIr, mapArtifact: string): UnitRefPlan {
  const gaps: DFinding[] = [];
  const gap = (targets: string[], detail: string, frRefs: string[] = []): void => {
    gaps.push({
      kind: "mapping-gap",
      frRefs: sortedUnique(frRefs, idCompare),
      targets: sortedUnique(targets, idCompare),
      witness: { refs: [{ artifact: mapArtifact, element: `units[${unitMap.unit}]` }] } as unknown as Json,
      unit: u.unit,
      detail,
    });
  };
  const reqAttrByPath = new Map(req.attrs.map((a) => [a.path, a]));
  const byReq = new Map<string, AttrMapping>();
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
    if (m.enumMap) {
      if (reqAttr.kind !== "enum") {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap entry "${m.req}" uses enumMap but the requirements attribute is ${reqAttr.kind}`);
      }
      if (!u.attrPaths.has(m.enumMap.from)) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap.from "${m.enumMap.from}" is not a design attribute of unit ${u.unit}`);
        continue;
      }
      const fromValues = designEnumValues(u, m.enumMap.from);
      if (fromValues === null) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap.from "${m.enumMap.from}" is not an enum design attribute`);
        continue;
      }
      const missing = fromValues.filter((v) => !(v in m.enumMap!.cases)).sort();
      if (missing.length > 0) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap for "${m.req}" is not total over "${m.enumMap.from}": missing case(s) ${missing.join(", ")}`);
      }
      const badResults = sortedUnique(Object.values(m.enumMap.cases).filter((rv) => !(reqAttr.values ?? []).includes(rv)), idCompare);
      if (badResults.length > 0) {
        gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap for "${m.req}" produces value(s) ${badResults.join(", ")} outside the requirements attribute's values`);
      }
    } else if (m.expr) {
      const refs = new Set<string>();
      exprRefs(m.expr, refs);
      for (const r of [...refs].sort()) {
        if (!u.attrPaths.has(r)) {
          gap([`attr:${m.req.replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap expression for "${m.req}" references "${r}", which is not a design attribute of unit ${u.unit}`);
        }
      }
    }
  }

  // Attribute closure: every requirements attribute is mapped or in unmapped[].
  for (const a of [...req.attrs].sort((x, y) => (x.path < y.path ? -1 : 1))) {
    if (!byReq.has(a.path) && !unmappedTargets.has(a.path)) {
      gap(
        [`attr:${a.path.replace(/[^A-Za-z0-9_./-]/g, "-")}`],
        `requirements attribute "${a.path}" is neither mapped by attrMap nor listed in unmapped[] — silence is a contract violation`,
      );
    }
  }

  const ctx: AlphaCtx = { byReq, reqAttrByPath };
  const eventByTrigger = new Map(unitMap.eventMap.map((e) => [e.reqTrigger, e] as const));
  const designIds = new Set<string>([
    ...u.obligations.map((o) => o.id),
    ...u.machines.flatMap((m: DesignMachine) => m.transitions.map((t) => t.id)),
  ]);

  const attrsCovered = (e: Expr | undefined): { ok: boolean; missing: string[] } => {
    if (!e) return { ok: true, missing: [] };
    const refs = new Set<string>();
    exprRefs(e, refs);
    const missing = [...refs].filter((r) => !byReq.has(r)).sort();
    return { ok: missing.length === 0, missing };
  };

  const obligationStatus = new Map<string, RefStatus>();
  const eventTransitions = new Map<string, string[]>();
  for (const ob of req.obligations) {
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

  const scenarioStatus = new Map<string, RefStatus>();
  for (const sc of req.scenarios) {
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

  // Obligation/scenario gap statuses become mapping-gap findings.
  for (const [id, st] of [...obligationStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "gap") {
      gap([id], `${id}: ${st.detail}`, req.obligations.find((o) => o.id === id)?.frRefs ?? []);
    }
  }
  for (const [id, st] of [...scenarioStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "gap") {
      gap([id], `${id}: ${st.detail}`, req.scenarios.find((s) => s.id === id)?.frRefs ?? []);
    }
  }

  return { ctx, obligationStatus, scenarioStatus, eventTransitions, gaps };
}

function designEnumValues(u: DesignUnit, attrPath: string): string[] | null {
  if (!Array.isArray(u.rawEntities)) return null;
  for (const ent of u.rawEntities) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
      if (`${ent.name}.${attr.name}` !== attrPath) continue;
      if (attr.type.kind !== "enum") return null;
      const values = (attr.type as { values?: Json }).values;
      return Array.isArray(values) ? (values.filter((v): v is string => typeof v === "string") as string[]) : null;
    }
  }
  return null;
}

// --- SMT-LIB script building (mirrors the v1 compiler's encoding) ------------

interface DesignSmtCtx {
  attrs: ReqAttr[]; // same shape as v1 AttrInfo, over the DESIGN unit
  byPath: Map<string, ReqAttr>;
}

export function designSmtCtx(u: DesignUnit): DesignSmtCtx {
  const attrs: ReqAttr[] = [];
  if (Array.isArray(u.rawEntities)) {
    for (const ent of u.rawEntities) {
      if (!isObject(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
        const t = attr.type;
        if (t.kind !== "bool" && t.kind !== "int" && t.kind !== "enum") continue;
        attrs.push({
          path: `${ent.name}.${attr.name}`,
          kind: t.kind,
          min: typeof t.min === "number" ? t.min : undefined,
          max: typeof t.max === "number" ? t.max : undefined,
          values: Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        });
      }
    }
  }
  return { attrs, byPath: new Map(attrs.map((a) => [a.path, a])) };
}

class SmtCompileError extends Error {}

function smtVar(path: string, primed: boolean): string {
  return `${primed ? "p" : "v"}_${path.replace(/\./g, "_")}`;
}

function smtLit(n: number): string {
  return n < 0 ? `(- ${-n})` : String(n);
}

function enumCode(ctx: DesignSmtCtx, attrPath: string, value: string): number {
  const attr = ctx.byPath.get(attrPath);
  if (!attr || attr.kind !== "enum" || !attr.values) throw new SmtCompileError(`"${attrPath}" is not an enum attribute`);
  const idx = attr.values.indexOf(value);
  if (idx < 0) throw new SmtCompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}

export function smtOfExpr(ctx: DesignSmtCtx, e: Expr): string {
  const bin = (op: string): string => {
    const [a, b] = e.args ?? [];
    if (!a || !b) throw new SmtCompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(ctx, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOfExpr(ctx, a);
      const right = b === enumArg ? code : smtOfExpr(ctx, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg) throw new SmtCompileError("enum literal without a ref sibling has no resolvable encoding");
    return `(${op} ${smtOfExpr(ctx, a)} ${smtOfExpr(ctx, b)})`;
  };
  switch (e.op) {
    case "and":
    case "or":
      return `(${e.op} ${(e.args ?? []).map((a) => smtOfExpr(ctx, a)).join(" ")})`;
    case "not":
      return `(not ${smtOfExpr(ctx, (e.args ?? [])[0] as Expr)})`;
    case "implies":
      return bin("=>");
    case "iff":
    case "eq":
      return bin("=");
    case "ne":
      return `(not ${bin("=")})`;
    case "lt":
      return bin("<");
    case "le":
      return bin("<=");
    case "gt":
      return bin(">");
    case "ge":
      return bin(">=");
    case "add":
      return bin("+");
    case "sub":
      return bin("-");
    case "mul":
      return bin("*");
    case "ref": {
      if (typeof e.path !== "string" || !ctx.byPath.has(e.path)) throw new SmtCompileError(`unresolvable reference "${e.path ?? ""}"`);
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n)) throw new SmtCompileError("int literal is not an integer");
      return smtLit(n);
    }
    default:
      throw new SmtCompileError(`unknown operator "${e.op}"`);
  }
}

export interface RefChildQuery {
  id: string;
  script: string;
  assumptions: string[];
  model: { name: string; sort: "Int" | "Bool" }[];
}

export interface RefChildResult {
  id: string;
  status: "sat" | "unsat" | "unknown" | "budget" | "error";
  model?: { [name: string]: string };
  core?: string[];
  error?: string;
}

export function designBase(ctx: DesignSmtCtx, u: DesignUnit, primed: boolean): { decls: string[]; constraints: { name: string; smt: string }[] } {
  const decls: string[] = [];
  const constraints: { name: string; smt: string }[] = [];
  for (const attr of ctx.attrs) {
    const sort = attr.kind === "bool" ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path, primed)} ${sort})`);
    const v = smtVar(attr.path, primed);
    if (attr.kind === "enum" && attr.values) {
      constraints.push({ name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`, smt: `(and (>= ${v} 0) (<= ${v} ${attr.values.length - 1}))` });
    } else if (attr.kind === "int" && (attr.min !== undefined || attr.max !== undefined)) {
      const parts: string[] = [];
      if (attr.min !== undefined) parts.push(`(>= ${v} ${smtLit(attr.min)})`);
      if (attr.max !== undefined) parts.push(`(<= ${v} ${smtLit(attr.max)})`);
      constraints.push({ name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`, smt: parts.length === 1 ? (parts[0] as string) : `(and ${parts.join(" ")})` });
    }
  }
  if (!primed) {
    for (const bg of u.background) {
      try {
        constraints.push({ name: `bg_${bg.id.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, bg.assert) });
      } catch {
        // uncompilable background is dropped here; the design pass reports it
      }
    }
    for (const ob of u.obligations) {
      if ((ob.nature === "invariant" || ob.nature === "numeric") && ob.assert) {
        try {
          constraints.push({ name: `inv_${ob.id.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, ob.assert) });
        } catch {
          // ditto
        }
      }
    }
  }
  return { decls, constraints };
}

export function assembleQuery(
  id: string,
  decls: string[],
  constraints: { name: string; smt: string }[],
  modelVars: { name: string; sort: "Int" | "Bool" }[],
): RefChildQuery {
  const script = [
    ...decls,
    ...constraints.flatMap((c) => [`(declare-const ${c.name} Bool)`, `(assert (=> ${c.name} ${c.smt}))`]),
  ].join("\n");
  return { id, script, assumptions: constraints.map((c) => c.name), model: modelVars };
}

// Executes queries on the PROVEN v1 z3 child (--smt-child of the v1 SMT
// sensor): runtime fallback, budgets, and result protocol are v1's.
export function runRefinementChild(queries: RefChildQuery[], budgetMs: number = CHILD_BUDGET_MS): { results: Map<string, RefChildResult> | null; unavailable: string | null } {
  const toolsDir = dirname(fileURLToPath(import.meta.url));
  const childHost = join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts");
  const payload = JSON.stringify({ queries, timeoutMs: PER_QUERY_TIMEOUT_MS, budgetMs });
  const override = process.env.AIDLC_DEEP_SPEC_SMT_RUNTIME;
  const runtimes = override ? [override] : ["node", "bun"];
  const attempts: string[] = [];
  for (const runtime of runtimes) {
    const res = spawnSync(runtime, [childHost, "--smt-child"], {
      input: payload,
      encoding: "utf-8",
      timeout: budgetMs + 15_000,
      cwd: process.cwd(),
    });
    if (res.error && (res.error as NodeJS.ErrnoException).code === "ENOENT") {
      attempts.push(`${runtime}: not on PATH`);
      continue;
    }
    if (res.error || res.status !== 0) {
      attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}`);
      continue;
    }
    try {
      const parsed = JSON.parse((res.stdout ?? "").trim().split("\n").pop() ?? "");
      if (typeof parsed.unavailable === "string") return { results: null, unavailable: parsed.unavailable };
      const map = new Map<string, RefChildResult>();
      for (const r of parsed.results ?? []) map.set(r.id, r);
      return { results: map, unavailable: null };
    } catch {
      attempts.push(`${runtime}: solver child produced unreadable output`);
    }
  }
  return { results: null, unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
}

export function decodeDesignModel(ctx: DesignSmtCtx, model: { [name: string]: string }, primed: boolean): { [path: string]: Json } {
  const out: { [path: string]: Json } = {};
  for (const attr of [...ctx.attrs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const raw = model[smtVar(attr.path, primed)];
    if (raw === undefined) continue;
    if (attr.kind === "bool") out[attr.path] = raw === "true";
    else {
      const m = raw.match(/^\(-\s*(\d+)\)$/);
      const n = m ? -Number.parseInt(m[1] ?? "0", 10) : Number.parseInt(raw, 10);
      if (attr.kind === "enum" && attr.values) out[attr.path] = attr.values[n] ?? n;
      else out[attr.path] = n;
    }
  }
  return out;
}

// Requirements event effect: which requirements attributes does it assign?
export function reqEffectAssignments(effect: Expr): Map<string, Expr> {
  const assignments = new Map<string, Expr>();
  const terms: Expr[] = [];
  const flatten = (e: Expr): void => {
    if (e.op === "and") for (const a of e.args ?? []) flatten(a);
    else terms.push(e);
  };
  flatten(effect);
  for (const term of terms) {
    if (term.op !== "eq") throw new AlphaError("requirements effect is not a conjunction of primed assignments");
    const [a, b] = term.args ?? [];
    const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
    if (!target || typeof target.path !== "string") throw new AlphaError("requirements effect is not a conjunction of primed assignments");
    assignments.set(target.path, term);
  }
  return assignments;
}

// --- design event catalog (guards + effect assignments, lowered) -------------

export interface DesignEvent {
  guard: Expr;
  effectAssign: Map<string, Expr>; // design attr path -> prime-free rhs
}

export function designEventCatalog(u: DesignUnit): Map<string, DesignEvent> {
  const out = new Map<string, DesignEvent>();
  const eqRef = (path: string, value: string): Expr => ({ op: "eq", args: [{ op: "ref", path }, { op: "enum", value }] });
  for (const sm of u.machines) {
    const attrPath = `${sm.entity}.${sm.attribute}`;
    for (const tr of sm.transitions) {
      const guard: Expr = tr.guard ? { op: "and", args: [eqRef(attrPath, tr.from), tr.guard] } : eqRef(attrPath, tr.from);
      const effectAssign = new Map<string, Expr>();
      effectAssign.set(attrPath, { op: "enum", value: tr.to });
      if (tr.effect) {
        try {
          for (const [path, term] of reqEffectAssignments(tr.effect)) {
            const [a, b] = term.args ?? [];
            const rhs = a?.op === "ref" && a.prime === true ? b : a;
            if (rhs) effectAssign.set(path, rhs);
          }
        } catch {
          // uncompilable extra effect: the design pass reports it; simulation
          // for this transition will fail closed via smtOfExpr below.
        }
      }
      out.set(tr.id, { guard, effectAssign });
    }
  }
  for (const ob of u.obligations) {
    if (ob.nature !== "event" || !ob.guard || !ob.effect) continue;
    const effectAssign = new Map<string, Expr>();
    try {
      for (const [path, term] of reqEffectAssignments(ob.effect)) {
        const [a, b] = term.args ?? [];
        const rhs = a?.op === "ref" && a.prime === true ? b : a;
        if (rhs) effectAssign.set(path, rhs);
      }
    } catch {
      continue;
    }
    out.set(ob.id, { guard: ob.guard, effectAssign });
  }
  return out;
}

// --- SMT refinement pass ------------------------------------------------------

export interface UnitRefinementResult {
  findings: DFinding[];
  skipped: DSkipped[];
  unavailable: string | null;
}

// Enum comparisons produced by alphaExpr always pair a ref with an enum
// literal, which smtOfExpr resolves against the ref's attribute — the same
// encoding contract as the v1 compiler.
export function runUnitRefinementSmt(u: DesignUnit, req: ReqIr, plan: UnitRefPlan, mapArtifact: string, budgetMs: number = CHILD_BUDGET_MS): UnitRefinementResult {
  const findings: DFinding[] = [...plan.gaps];
  const skipped: DSkipped[] = [];
  const skip = (target: string, reason: string, detail: string): void => {
    skipped.push({ target, reason, unit: u.unit, detail });
  };
  for (const [id, st] of [...plan.obligationStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "waived") skip(id, "waived", st.reason);
    if (st.kind === "capability") skip(id, "capability", st.detail);
  }
  for (const [id, st] of [...plan.scenarioStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind === "waived") skip(id, "waived", st.reason);
    if (st.kind === "capability") skip(id, "capability", st.detail);
  }

  const ctx = designSmtCtx(u);
  const pre = designBase(ctx, u, false);
  const post = designBase(ctx, u, true);
  const modelVars = ctx.attrs.map((a) => ({ name: smtVar(a.path, false), sort: (a.kind === "bool" ? "Bool" : "Int") as "Int" | "Bool" }));
  const modelVarsBoth = [...modelVars, ...ctx.attrs.map((a) => ({ name: smtVar(a.path, true), sort: (a.kind === "bool" ? "Bool" : "Int") as "Int" | "Bool" }))];
  const catalog = designEventCatalog(u);
  const obById = new Map(req.obligations.map((o) => [o.id, o]));
  const scById = new Map(req.scenarios.map((s) => [s.id, s]));
  const queries: RefChildQuery[] = [];
  interface Pending {
    kind: "invariant" | "scenario" | "enabledness" | "simulation";
    reqId: string;
    designId?: string;
  }
  const pending = new Map<string, Pending>();
  const alphaFail = (target: string, err: unknown): void => {
    skip(target, "compile-error", `alpha substitution failed: ${err instanceof Error ? err.message : String(err)}`);
  };

  for (const [obId, st] of [...plan.obligationStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind !== "checkable") continue;
    const ob = obById.get(obId);
    if (!ob) continue;
    if ((ob.nature === "invariant" || ob.nature === "numeric") && ob.assert) {
      try {
        const alphaP = alphaExpr(plan.ctx, ob.assert, false);
        const q = assembleQuery(`rv:${obId}`, pre.decls, [...pre.constraints, { name: `neg_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: `(not ${smtOfExpr(ctx, alphaP)})` }], modelVars);
        queries.push(q);
        pending.set(q.id, { kind: "invariant", reqId: obId });
      } catch (err) {
        alphaFail(obId, err);
      }
      continue;
    }
    if (ob.nature === "event" && ob.guard && ob.effect) {
      const mapped = plan.eventTransitions.get(obId) ?? [];
      try {
        const alphaG = alphaExpr(plan.ctx, ob.guard, false);
        // Enabledness: alpha(guard) holds but no mapped design event is enabled.
        const designGuards = mapped
          .map((id) => catalog.get(id))
          .filter((d): d is DesignEvent => d !== undefined)
          .map((d) => smtOfExpr(ctx, d.guard));
        const notEnabled = designGuards.length === 0 ? "true" : `(not (or ${designGuards.join(" ")}))`;
        const qe = assembleQuery(
          `re:${obId}`,
          pre.decls,
          [
            ...pre.constraints,
            { name: `ag_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, alphaG) },
            { name: `ne_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: notEnabled },
          ],
          modelVars,
        );
        queries.push(qe);
        pending.set(qe.id, { kind: "enabledness", reqId: obId });

        // One-step simulation per mapped design event: a step taken where
        // alpha(guard) holds whose abstract post violates the requirements
        // effect or the abstract frame (Q2: unassigned requirements
        // attributes keep their abstract value; frame equalities for
        // unmapped attributes are uncheckable and therefore omitted).
        const assigned = reqEffectAssignments(ob.effect);
        const frameParts: string[] = [];
        for (const a of [...req.attrs].sort((x, y) => (x.path < y.path ? -1 : 1))) {
          if (assigned.has(a.path)) continue;
          const eq = alphaEquality(plan.ctx, a.path);
          if (eq !== null) frameParts.push(smtOfExpr(ctx, eq));
        }
        const fBar = smtOfExpr(ctx, alphaExpr(plan.ctx, ob.effect, false));
        const postCond = frameParts.length === 0 ? fBar : `(and ${fBar} ${frameParts.join(" ")})`;
        for (const designId of mapped) {
          const ev = catalog.get(designId);
          if (!ev) continue;
          const stepParts: string[] = [smtOfExpr(ctx, ev.guard)];
          for (const attr of ctx.attrs) {
            const rhs = ev.effectAssign.get(attr.path);
            const target = smtVar(attr.path, true);
            if (rhs) {
              const rhsSmt = rhs.op === "enum" && typeof rhs.value === "string"
                ? String(enumCodePublic(ctx, attr.path, rhs.value))
                : smtOfExpr(ctx, rhs);
              stepParts.push(`(= ${target} ${rhsSmt})`);
            } else {
              stepParts.push(`(= ${target} ${smtVar(attr.path, false)})`);
            }
          }
          const qs = assembleQuery(
            `rs2:${obId}:${designId}`,
            [...pre.decls, ...post.decls],
            [
              ...pre.constraints,
              ...post.constraints,
              { name: `step_${designId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: `(and ${stepParts.join(" ")})` },
              { name: `ag2_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: smtOfExpr(ctx, alphaG) },
              { name: `viol_${obId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: `(not ${postCond})` },
            ],
            modelVarsBoth,
          );
          queries.push(qs);
          pending.set(qs.id, { kind: "simulation", reqId: obId, designId });
        }
      } catch (err) {
        alphaFail(obId, err);
      }
    }
  }

  for (const [scId, st] of [...plan.scenarioStatus.entries()].sort((a, b) => idCompare(a[0], b[0]))) {
    if (st.kind !== "checkable") continue;
    const sc = scById.get(scId);
    if (!sc) continue;
    try {
      const parts: string[] = [];
      for (const [path, value] of Object.entries(sc.bindings).sort(([x], [y]) => (x < y ? -1 : 1))) {
        const reqAttr = plan.ctx.reqAttrByPath.get(path);
        const lit: Expr = typeof value === "boolean" ? { op: "bool", value } : typeof value === "number" ? { op: "int", value } : { op: "enum", value };
        const constraint: Expr = { op: "eq", args: [{ op: "ref", path }, lit] };
        void reqAttr;
        parts.push(smtOfExpr(ctx, alphaExpr(plan.ctx, constraint, false)));
      }
      const q = assembleQuery(
        `rs:${scId}`,
        pre.decls,
        [...pre.constraints, { name: `sc_${scId.replace(/[^A-Za-z0-9_]/g, "_")}`, smt: parts.length === 1 ? (parts[0] as string) : `(and ${parts.join(" ")})` }],
        modelVars,
      );
      queries.push(q);
      pending.set(q.id, { kind: "scenario", reqId: scId });
    } catch (err) {
      alphaFail(scId, err);
    }
  }

  if (queries.length === 0) return { findings, skipped, unavailable: null };
  const child = runRefinementChild(queries, budgetMs);
  if (child.results === null) return { findings, skipped, unavailable: child.unavailable ?? "z3 unavailable" };
  const results = child.results;

  const frOf = (reqId: string): string[] =>
    sortedUnique(obById.get(reqId)?.frRefs ?? scById.get(reqId)?.frRefs ?? [], idCompare);
  const emit = (f: DFinding): void => {
    findings.push(f);
  };
  for (const q of queries) {
    const p = pending.get(q.id);
    const r = results.get(q.id);
    if (!p) continue;
    if (!r || r.status === "unknown" || r.status === "budget" || r.status === "error") {
      skip(p.reqId, "timeout", `refinement query ${q.id} exceeded the solver budget or errored`);
      continue;
    }
    if (p.kind === "invariant") {
      if (r.status === "sat") {
        emit({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: [p.reqId],
          witness: { model: decodeDesignModel(ctx, r.model ?? {}, false) } as unknown as Json,
          unit: u.unit,
          detail: `A design-legal state of unit ${u.unit} violates requirements obligation ${p.reqId} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`,
        });
      }
    } else if (p.kind === "scenario") {
      const sc = scById.get(p.reqId);
      if (sc?.kind === "accept" && r.status === "unsat") {
        emit({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: [p.reqId],
          witness: { core: (r.core ?? []).sort() } as unknown as Json,
          unit: u.unit,
          detail: `Accept scenario ${p.reqId} has no design-legal counterpart in unit ${u.unit} under the refinement map: the design excludes an example the requirements accept (witness core attached).`,
        });
      }
      if (sc?.kind === "reject" && r.status === "sat") {
        emit({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: [p.reqId],
          witness: { model: decodeDesignModel(ctx, r.model ?? {}, false) } as unknown as Json,
          unit: u.unit,
          detail: `Reject scenario ${p.reqId} is still admitted by unit ${u.unit} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`,
        });
      }
    } else if (p.kind === "enabledness") {
      if (r.status === "sat") {
        emit({
          kind: "completeness-gap",
          frRefs: frOf(p.reqId),
          targets: sortedUnique([p.reqId, ...(plan.eventTransitions.get(p.reqId) ?? [])], idCompare),
          witness: { model: decodeDesignModel(ctx, r.model ?? {}, false) } as unknown as Json,
          unit: u.unit,
          detail: `The requirements event ${p.reqId} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`,
        });
      }
    } else if (p.kind === "simulation") {
      if (r.status === "sat") {
        const preState = decodeDesignModel(ctx, r.model ?? {}, false);
        const postState = decodeDesignModel(ctx, r.model ?? {}, true);
        emit({
          kind: "refinement-violation",
          frRefs: frOf(p.reqId),
          targets: sortedUnique([p.reqId, p.designId ?? ""], idCompare).filter((t) => t !== ""),
          witness: { trace: [preState, postState] } as unknown as Json,
          unit: u.unit,
          detail: `Design step ${p.designId} of unit ${u.unit}, taken where requirements event ${p.reqId} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`,
        });
      }
    }
  }
  void mapArtifact;
  return { findings, skipped, unavailable: null };
}

function enumCodePublic(ctx: DesignSmtCtx, attrPath: string, value: string): number {
  const attr = ctx.byPath.get(attrPath);
  if (!attr || attr.kind !== "enum" || !attr.values) throw new SmtCompileError(`"${attrPath}" is not an enum attribute`);
  const idx = attr.values.indexOf(value);
  if (idx < 0) throw new SmtCompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}

// --- Quint refinement extras --------------------------------------------------
// alpha(P) for every checkable invariant/numeric requirements obligation,
// appended to the unit's lowering as extra invariant obligations: a violation
// trace whose violated component is one of these is a REACHABLE refinement
// break.
export function refinementQuintExtras(plan: UnitRefPlan, req: ReqIr): { reqId: string; frRefs: string[]; expr: Expr }[] {
  const out: { reqId: string; frRefs: string[]; expr: Expr }[] = [];
  for (const ob of [...req.obligations].sort((a, b) => idCompare(a.id, b.id))) {
    if (plan.obligationStatus.get(ob.id)?.kind !== "checkable") continue;
    if ((ob.nature !== "invariant" && ob.nature !== "numeric") || !ob.assert) continue;
    try {
      out.push({ reqId: ob.id, frRefs: ob.frRefs, expr: alphaExpr(plan.ctx, ob.assert, false) });
    } catch {
      // reported by the SMT pass as compile-error skip
    }
  }
  return out;
}

export type { DSkipped as RefSkipped, DFinding as RefFinding };
