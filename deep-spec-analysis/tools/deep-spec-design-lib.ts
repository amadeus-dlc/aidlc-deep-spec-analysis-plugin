// Shared machinery for the deep-spec-design-verify-* sensors (phase 2 of the
// design-verification extension).
//
// The central idea is COMPILE-DOWN REUSE: a design IR unit (contract 3 —
// native state machines, rules-origin obligations, scenarios) is lowered to a
// contract-1 requirements IR document, and the PROVEN v1 backends are executed
// on it as child processes. The lowered findings are then remapped back into
// design vocabulary (DOB/TR/SM/DSC ids, per-unit attribution). The two checks
// v1 does not have are obtained without new solver plumbing:
//
//   unreachable (dead guard)  — a synthetic tautological invariant
//                               implies(guard, true) rides v1's antecedent-
//                               vacuity query: the antecedent (the guard)
//                               being unsatisfiable IS deadness.
//   redundancy (shadowing)    — implies(and(guardB, not(guardA)), true):
//                               vacuity proves guardB => guardA; combined
//                               with canonically-equal effects, B is subsumed.
//
// The synthetic invariants are tautologies, so they never change the global,
// gap, or scenario verdicts of the lowered document.
//
// This is a PLUGIN-INTERNAL library shipped in the same compose delta as the
// sensors that import it (self-containment = no framework/core imports).

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
} from "./deep-spec-lib.ts";

export const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
export const DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";
export const DESIGN_IR_MAJOR_SUPPORTED = 1;

// --- design IR types ---------------------------------------------------------

export interface Expr {
  op: string;
  args?: Expr[];
  path?: string;
  prime?: boolean;
  value?: boolean | number | string;
}

export interface DesignTransition {
  id: string;
  from: string;
  to: string;
  trigger: string;
  guard?: Expr;
  effect?: Expr;
  brRefs: string[];
}

export interface DesignMachine {
  id: string;
  entity: string;
  attribute: string;
  initial: string[];
  transitions: DesignTransition[];
  ignores: { state: string; trigger: string; reason: string }[];
  deterministic: boolean;
}

export interface DesignObligation {
  id: string;
  nature: string;
  origin: string;
  brRefs: string[];
  frRefs: string[];
  assert?: Expr;
  trigger?: string;
  guard?: Expr;
  effect?: Expr;
  temporal?: { pattern: string; assert?: Expr; from?: Expr; to?: Expr };
}

export interface DesignScenario {
  id: string;
  kind: "accept" | "reject";
  brRefs: string[];
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expr;
}

export interface DesignUnit {
  unit: string;
  rawEntities: Json;
  attrPaths: Set<string>;
  obligations: DesignObligation[];
  machines: DesignMachine[];
  scenarios: DesignScenario[];
  background: { id: string; assert: Expr }[];
}

export interface DesignIr {
  irVersion: string;
  units: DesignUnit[];
}

const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);

export function extractSingleJsonFence(md: string): string | null {
  const fences: string[] = [];
  let open = false;
  let info = "";
  let buf: string[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\s*```(.*)$/);
    if (m && !open) {
      open = true;
      info = (m[1] ?? "").trim().toLowerCase();
      buf = [];
      continue;
    }
    if (m && open) {
      if (info === "json" || info.startsWith("json ")) fences.push(buf.join("\n"));
      open = false;
      continue;
    }
    if (open) buf.push(line);
  }
  return fences.length === 1 ? (fences[0] ?? null) : null;
}

export function parseDesignIr(raw: Json): DesignIr | string {
  if (!isObject(raw)) return "design IR is not a JSON object";
  if (raw.irKind !== "design") return 'document is not a design IR (missing `"irKind": "design"`)';
  const irVersion = typeof raw.irVersion === "string" ? raw.irVersion : "";
  if (!/^\d+\.\d+\.\d+$/.test(irVersion)) return "design IR lacks a semver irVersion";
  if (!Array.isArray(raw.units) || raw.units.length === 0) return "design IR carries no units[]";
  const units: DesignUnit[] = [];
  for (const rawUnit of raw.units) {
    if (!isObject(rawUnit) || typeof rawUnit.unit !== "string") continue;
    const schema = isObject(rawUnit.schema) ? rawUnit.schema : {};
    const rawEntities = Array.isArray(schema.entities) ? schema.entities : [];
    const attrPaths = new Set<string>();
    for (const ent of rawEntities) {
      if (!isObject(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (isObject(attr) && typeof attr.name === "string") attrPaths.add(`${ent.name}.${attr.name}`);
      }
    }
    const obligations: DesignObligation[] = [];
    for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
      obligations.push({
        id: ob.id,
        nature: ob.nature,
        origin: typeof ob.origin === "string" ? ob.origin : "",
        brRefs: strArr(ob.brRefs),
        frRefs: strArr(ob.frRefs),
        assert: isObject(ob.assert) ? (ob.assert as unknown as Expr) : undefined,
        trigger: typeof ob.trigger === "string" ? ob.trigger : undefined,
        guard: isObject(ob.guard) ? (ob.guard as unknown as Expr) : undefined,
        effect: isObject(ob.effect) ? (ob.effect as unknown as Expr) : undefined,
        temporal: isObject(ob.temporal) ? (ob.temporal as unknown as DesignObligation["temporal"]) : undefined,
      });
    }
    const machines: DesignMachine[] = [];
    for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
      if (!isObject(sm) || typeof sm.id !== "string" || typeof sm.entity !== "string" || typeof sm.attribute !== "string") continue;
      const transitions: DesignTransition[] = [];
      for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
        if (!isObject(tr) || typeof tr.id !== "string") continue;
        if (typeof tr.from !== "string" || typeof tr.to !== "string" || typeof tr.trigger !== "string") continue;
        transitions.push({
          id: tr.id,
          from: tr.from,
          to: tr.to,
          trigger: tr.trigger,
          guard: isObject(tr.guard) ? (tr.guard as unknown as Expr) : undefined,
          effect: isObject(tr.effect) ? (tr.effect as unknown as Expr) : undefined,
          brRefs: strArr(tr.brRefs),
        });
      }
      const ignores: DesignMachine["ignores"] = [];
      for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
        if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
        ignores.push({ state: ig.state, trigger: ig.trigger, reason: typeof ig.reason === "string" ? ig.reason : "" });
      }
      machines.push({
        id: sm.id,
        entity: sm.entity,
        attribute: sm.attribute,
        initial: strArr(sm.initial),
        transitions,
        ignores,
        deterministic: sm.deterministic !== false,
      });
    }
    const scenarios: DesignScenario[] = [];
    for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string") continue;
      const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
      if (kind === null || !isObject(sc.bindings)) continue;
      const bindings: DesignScenario["bindings"] = {};
      for (const [k, v] of Object.entries(sc.bindings)) {
        if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
      }
      scenarios.push({
        id: sc.id,
        kind,
        brRefs: strArr(sc.brRefs),
        frRefs: strArr(sc.frRefs),
        bindings,
        event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: sc.event.trigger } : undefined,
        expect: isObject(sc.expect) ? (sc.expect as unknown as Expr) : undefined,
      });
    }
    const background: DesignUnit["background"] = [];
    for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
      if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
      background.push({ id: bg.id, assert: bg.assert as unknown as Expr });
    }
    units.push({ unit: rawUnit.unit, rawEntities: rawEntities as Json, attrPaths, obligations, machines, scenarios, background });
  }
  if (units.length === 0) return "design IR carries no parseable units";
  return { irVersion, units: [...units].sort((a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0)) };
}

// --- lowering (design unit -> contract-1 document) ---------------------------

export type LowKind = "passthrough" | "transition" | "ignore" | "vac-dead" | "vac-shadow";

export interface LowEntry {
  design: string;
  kind: LowKind;
  pair?: [string, string];
}

export interface Lowered {
  v1Doc: Json;
  map: Map<string, LowEntry>;
  scenarioMap: Map<string, string>;
  machineOfTransition: Map<string, DesignMachine>;
  attrPathOfMachine: Map<string, string>;
}

const eqRef = (path: string, prime: boolean, value: string): Expr => ({
  op: "eq",
  args: [{ op: "ref", path, ...(prime ? { prime: true } : {}) }, { op: "enum", value }],
});

export function lowerUnit(u: DesignUnit, opts: { synthetics: boolean }): Lowered {
  const map = new Map<string, LowEntry>();
  const scenarioMap = new Map<string, string>();
  const machineOfTransition = new Map<string, DesignMachine>();
  const attrPathOfMachine = new Map<string, string>();
  const obligations: Json[] = [];
  let n = 0;
  const nextId = (): string => {
    n += 1;
    return `OB-${n}`;
  };
  const push = (ob: { [k: string]: Json }, entry: LowEntry): string => {
    const id = nextId();
    obligations.push({ id, ...ob });
    map.set(id, entry);
    return id;
  };

  interface EventCandidate {
    lowId: string;
    design: string;
    trigger: string;
    guard: Expr;
    effect: Expr;
  }
  const candidates: EventCandidate[] = [];

  // 1) Design obligations pass through (frRefs kept for finding attribution;
  //    empty frRefs are legal in the lowered document — the v1 backends treat
  //    frRefs as opaque attribution strings).
  for (const ob of [...u.obligations].sort((a, b) => idCompare(a.id, b.id))) {
    const lowered: { [k: string]: Json } = {
      nature: ob.nature,
      frRefs: ob.frRefs as unknown as Json,
    };
    if (ob.assert) lowered.assert = ob.assert as unknown as Json;
    if (ob.trigger !== undefined) lowered.trigger = ob.trigger;
    if (ob.guard) lowered.guard = ob.guard as unknown as Json;
    if (ob.effect) lowered.effect = ob.effect as unknown as Json;
    if (ob.temporal) lowered.temporal = ob.temporal as unknown as Json;
    const lowId = push(lowered, { design: ob.id, kind: "passthrough" });
    if (ob.nature === "event" && ob.guard && ob.effect && ob.trigger) {
      candidates.push({ lowId, design: ob.id, trigger: ob.trigger, guard: ob.guard, effect: ob.effect });
    }
  }

  // 2) State machines compile down: transition -> event obligation with the
  //    implicit state==from guard and state'=to effect; ignores -> explicit
  //    no-op events, so intended silence never reads as a gap or deadlock.
  for (const sm of [...u.machines].sort((a, b) => idCompare(a.id, b.id))) {
    const attrPath = `${sm.entity}.${sm.attribute}`;
    attrPathOfMachine.set(sm.id, attrPath);
    for (const tr of [...sm.transitions].sort((a, b) => idCompare(a.id, b.id))) {
      const guard: Expr = tr.guard ? { op: "and", args: [eqRef(attrPath, false, tr.from), tr.guard] } : eqRef(attrPath, false, tr.from);
      const effect: Expr = tr.effect ? { op: "and", args: [eqRef(attrPath, true, tr.to), tr.effect] } : eqRef(attrPath, true, tr.to);
      const lowId = push(
        { nature: "event", frRefs: [] as unknown as Json, trigger: tr.trigger, guard: guard as unknown as Json, effect: effect as unknown as Json },
        { design: tr.id, kind: "transition" },
      );
      machineOfTransition.set(tr.id, sm);
      candidates.push({ lowId, design: tr.id, trigger: tr.trigger, guard, effect });
    }
    const sortedIgnores = [...sm.ignores].sort((a, b) => (`${a.state}/${a.trigger}` < `${b.state}/${b.trigger}` ? -1 : 1));
    for (const ig of sortedIgnores) {
      const effect: Expr = { op: "eq", args: [{ op: "ref", path: attrPath, prime: true }, { op: "ref", path: attrPath }] };
      push(
        {
          nature: "event",
          frRefs: [] as unknown as Json,
          trigger: ig.trigger,
          guard: eqRef(attrPath, false, ig.state) as unknown as Json,
          effect: effect as unknown as Json,
        },
        { design: sm.id, kind: "ignore" },
      );
    }
  }

  // 3) Synthetic tautologies (SMT lowering only): dead guards and shadowing
  //    ride v1's antecedent-vacuity check without new solver plumbing.
  if (opts.synthetics) {
    for (const c of candidates) {
      push(
        { nature: "invariant", frRefs: [] as unknown as Json, assert: { op: "implies", args: [c.guard, { op: "bool", value: true }] } as unknown as Json },
        { design: c.design, kind: "vac-dead" },
      );
    }
    const byTrigger = new Map<string, EventCandidate[]>();
    for (const c of candidates) {
      const list = byTrigger.get(c.trigger) ?? [];
      list.push(c);
      byTrigger.set(c.trigger, list);
    }
    for (const trigger of [...byTrigger.keys()].sort()) {
      const list = byTrigger.get(trigger) ?? [];
      for (const a of list) {
        for (const b of list) {
          if (a === b) continue;
          if (canonicalStringify(a.effect as unknown as Json) !== canonicalStringify(b.effect as unknown as Json)) continue;
          // vacuity of (guardB and not guardA) proves guardB => guardA: b is
          // subsumed by a (same trigger, provably narrower guard, same effect).
          push(
            {
              nature: "invariant",
              frRefs: [] as unknown as Json,
              assert: {
                op: "implies",
                args: [{ op: "and", args: [b.guard, { op: "not", args: [a.guard] }] }, { op: "bool", value: true }],
              } as unknown as Json,
            },
            { design: `${a.design}|${b.design}`, kind: "vac-shadow", pair: [a.design, b.design] },
          );
        }
      }
    }
  }

  // 4) Scenarios and background.
  const scenarios: Json[] = [];
  let scN = 0;
  for (const sc of [...u.scenarios].sort((a, b) => idCompare(a.id, b.id))) {
    scN += 1;
    const lowId = `SC-${scN}`;
    scenarioMap.set(lowId, sc.id);
    const lowered: { [k: string]: Json } = {
      id: lowId,
      kind: sc.kind,
      frRefs: sc.frRefs as unknown as Json,
      bindings: sc.bindings as unknown as Json,
    };
    if (sc.event) lowered.event = sc.event as unknown as Json;
    if (sc.expect) lowered.expect = sc.expect as unknown as Json;
    scenarios.push(lowered);
  }
  const background: Json[] = [];
  let bgN = 0;
  for (const bg of [...u.background].sort((a, b) => idCompare(a.id, b.id))) {
    bgN += 1;
    background.push({ id: `BG-${bgN}`, assert: bg.assert as unknown as Json });
  }

  const v1Doc: Json = {
    irVersion: "1.0.0",
    schema: { entities: u.rawEntities },
    obligations: obligations as unknown as Json,
    scenarios: scenarios as unknown as Json,
    background: background as unknown as Json,
  };
  return { v1Doc, map, scenarioMap, machineOfTransition, attrPathOfMachine };
}

// --- sibling backend execution ----------------------------------------------

export interface SiblingRun {
  exit: number | null;
  doc: Json | null;
  note: string;
}

export function runSiblingBackend(backend: "smt" | "quint", loweredDoc: Json, wallTimeoutMs: number): SiblingRun {
  const toolsDir = dirname(fileURLToPath(import.meta.url));
  const tool = join(toolsDir, `aidlc-sensor-deep-spec-verify-${backend}.ts`);
  const work = mkdtempSync(join(tmpdir(), "deep-spec-design-lower-"));
  try {
    const modelPath = join(work, "deep-spec-analysis-formal-model.md");
    writeFileSync(modelPath, `# Lowered design unit\n\n\`\`\`json\n${JSON.stringify(loweredDoc, null, 2)}\n\`\`\`\n`, "utf-8");
    const res = spawnSync("bun", [tool, "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath], {
      encoding: "utf-8",
      timeout: wallTimeoutMs,
      cwd: process.cwd(),
    });
    const findingsPath = join(work, "deep-spec-verify", `${backend}.json`);
    let doc: Json | null = null;
    try {
      doc = JSON.parse(readFileSync(findingsPath, "utf-8")) as Json;
    } catch {
      doc = null;
    }
    const note = res.error ? String(res.error) : (res.stdout ?? "").trim().split("\n").pop() ?? "";
    return { exit: res.status, doc, note };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// --- remapping lowered findings back into design vocabulary ------------------

export interface DFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: Json;
  unit: string;
  detail: string;
}

export interface DSkipped {
  target: string;
  reason: string;
  unit: string;
  detail?: string;
}

function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

export function remapUnitDoc(
  u: DesignUnit,
  low: Lowered,
  raw: Json,
): { findings: DFinding[]; skipped: DSkipped[]; unavailable: string | null; method: string | null } {
  if (!isObject(raw)) return { findings: [], skipped: [], unavailable: "sibling backend produced no findings document", method: null };
  if (isObject(raw.unavailable) && typeof raw.unavailable.reason === "string") {
    return { findings: [], skipped: [], unavailable: raw.unavailable.reason, method: typeof raw.method === "string" ? raw.method : null };
  }
  const method = typeof raw.method === "string" ? raw.method : null;
  const mapTarget = (t: string): { design: string; entry: LowEntry | null } => {
    const entry = low.map.get(t) ?? null;
    if (entry) return { design: entry.design, entry };
    const dsc = low.scenarioMap.get(t);
    if (dsc) return { design: dsc, entry: null };
    return { design: t, entry: null };
  };
  const remapCore = (core: Json): Json => {
    if (!Array.isArray(core)) return core;
    return core.map((label) => {
      if (typeof label !== "string") return label;
      return label.replace(/OB_([0-9]+)/g, (m, num) => {
        const entry = low.map.get(`OB-${num}`);
        return entry ? designToken(entry.design) : m;
      });
    });
  };
  // Lowered ids never leak into design-facing text: OB-n references inside a
  // v1 detail are rewritten to their design ids ("DOB-2" contains no \bOB-2\b
  // boundary, so design ids are never double-rewritten).
  const remapDetail = (detail: string): string =>
    detail.replace(/\bOB-([0-9]+)\b/g, (m, num) => low.map.get(`OB-${num}`)?.design ?? m);

  const findings: DFinding[] = [];
  const skipped: DSkipped[] = [];
  const waived = new Set<string>();
  const deadDesignIds = new Set<string>();
  const shadowFindings: { finding: DFinding; subsumer: string; subsumed: string }[] = [];

  for (const f of Array.isArray(raw.findings) ? raw.findings : []) {
    if (!isObject(f) || typeof f.kind !== "string" || !Array.isArray(f.targets)) continue;
    const rawTargets = f.targets.filter((t): t is string => typeof t === "string");
    const mapped = rawTargets.map(mapTarget);
    const frRefs = strArr(f.frRefs);
    const detail = remapDetail(typeof f.detail === "string" ? f.detail : "");
    let witness = (f.witness ?? null) as Json;
    if (isObject(witness) && "core" in witness) {
      witness = { core: remapCore(witness.core ?? null) } as unknown as Json;
    }

    const synth = mapped.find((m) => m.entry?.kind === "vac-dead" || m.entry?.kind === "vac-shadow");
    if (synth?.entry?.kind === "vac-dead" && f.kind === "conflict") {
      const design = synth.entry.design;
      const isTransition = low.machineOfTransition.has(design);
      deadDesignIds.add(design);
      findings.push({
        kind: "unreachable",
        frRefs,
        targets: [design],
        witness,
        unit: u.unit,
        detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`,
      });
      continue;
    }
    if (synth?.entry?.kind === "vac-shadow" && f.kind === "conflict") {
      const pair = synth.entry.pair ?? [synth.entry.design, synth.entry.design];
      shadowFindings.push({
        finding: {
          kind: "redundancy",
          frRefs,
          targets: sortedUnique([pair[0], pair[1]], idCompare),
          witness,
          unit: u.unit,
          detail: `${pair[1]} is subsumed by ${pair[0]}: same trigger, a provably narrower guard, and an identical effect — it can never apply where ${pair[0]} does not.`,
        },
        subsumer: pair[0],
        subsumed: pair[1],
      });
      continue;
    }
    if (synth) continue; // any other verdict touching a synthetic is noise

    const targets = sortedUnique(mapped.map((m) => m.design), idCompare);
    // deterministic:false waiver: a same-trigger conflict whose targets are
    // all transitions of one machine that declared nondeterminism.
    if (f.kind === "conflict" && targets.length > 0) {
      const machines = targets.map((t) => low.machineOfTransition.get(t));
      const first = machines[0];
      if (first && machines.every((m) => m === first) && first.deterministic === false) {
        for (const t of targets) {
          if (!waived.has(t)) {
            waived.add(t);
            skipped.push({
              target: t,
              reason: "waived",
              unit: u.unit,
              detail: `machine ${first.id} declares deterministic: false — the same-(state,trigger) overlap check is waived by the model`,
            });
          }
        }
        continue;
      }
    }
    findings.push({ kind: f.kind, frRefs, targets, witness, unit: u.unit, detail });
  }

  // Shadow post-pass: a dead rule/transition is already `unreachable` — its
  // vacuous subsumption adds nothing; and a mutual subsumption (both
  // directions proven) collapses into one "equivalent" finding.
  const liveShadows = shadowFindings.filter((s) => !deadDesignIds.has(s.subsumed) && !deadDesignIds.has(s.subsumer));
  const byPair = new Map<string, typeof liveShadows>();
  for (const s of liveShadows) {
    const key = s.finding.targets.join(",");
    const list = byPair.get(key) ?? [];
    list.push(s);
    byPair.set(key, list);
  }
  for (const key of [...byPair.keys()].sort()) {
    const list = byPair.get(key) ?? [];
    const directions = new Set(list.map((s) => `${s.subsumer}>${s.subsumed}`));
    const first = list[0];
    if (!first) continue;
    if (list.length >= 2 && directions.size >= 2) {
      const [a, b] = first.finding.targets;
      findings.push({
        ...first.finding,
        detail: `${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.`,
      });
    } else {
      findings.push(first.finding);
    }
  }

  const seenSkip = new Set<string>();
  for (const s of Array.isArray(raw.skipped) ? raw.skipped : []) {
    if (!isObject(s) || typeof s.target !== "string" || typeof s.reason !== "string") continue;
    const { design, entry } = mapTarget(s.target);
    if (entry?.kind === "vac-dead" || entry?.kind === "vac-shadow") continue; // synthetic budget noise
    const key = `${design}|${s.reason}`;
    if (seenSkip.has(key)) continue;
    seenSkip.add(key);
    const out: DSkipped = { target: design, reason: s.reason, unit: u.unit };
    if (typeof s.detail === "string") out.detail = remapDetail(s.detail);
    skipped.push(out);
  }
  return { findings, skipped, unavailable: null, method };
}

export function allUnitTargets(u: DesignUnit): string[] {
  return sortedUnique(
    [
      ...u.obligations.map((o) => o.id),
      ...u.machines.flatMap((m) => m.transitions.map((t) => t.id)),
      ...u.scenarios.map((s) => s.id),
    ],
    idCompare,
  );
}

// --- design findings document assembly (contract 2) --------------------------

const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  unreachable: 3,
  redundancy: 4,
  "refinement-violation": 5,
  "mapping-gap": 6,
  "structure-invalid": 7,
  "reference-broken": 8,
  "consistency-mismatch": 9,
  "cross-check-disagreement": 10,
};

export function sortDesignFindings(findings: DFinding[]): DFinding[] {
  return [...findings].sort((a, b) => {
    const kr = (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99);
    if (kr !== 0) return kr;
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export function sortDesignSkipped(skipped: DSkipped[]): DSkipped[] {
  return [...skipped].sort((a, b) => {
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

export interface DesignDoc {
  backend: string;
  irVersion: string;
  irHash: string;
  method: string;
  unavailable?: { reason: string };
  inputs?: { artifact: string; sha256: string }[];
  findings: DFinding[];
  skipped: DSkipped[];
  crossChecked?: { backend: string; targets: string[] }[];
}

export interface DesignEmitResult {
  findingsCount: number;
  skippedCount: number;
  unavailable: boolean;
}

export function writeDesignDoc(verifyDir: string, doc: DesignDoc): DesignEmitResult {
  mkdirSync(verifyDir, { recursive: true });
  const assemble = (d: DesignDoc): { [k: string]: Json } => {
    const ordered: { [k: string]: Json } = {
      backend: d.backend,
      irVersion: d.irVersion,
      irHash: d.irHash,
      method: d.method,
    };
    if (d.unavailable) ordered.unavailable = d.unavailable as unknown as Json;
    if (d.inputs) {
      ordered.inputs = [...d.inputs].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0)) as unknown as Json;
    }
    ordered.findings = sortDesignFindings(d.findings) as unknown as Json;
    ordered.skipped = sortDesignSkipped(d.skipped) as unknown as Json;
    if (d.crossChecked) ordered.crossChecked = d.crossChecked as unknown as Json;
    return ordered;
  };
  let ordered = assemble(doc);
  try {
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json");
    const schemaDoc = JSON.parse(readFileSync(schemaPath, "utf-8"));
    const errors: string[] = [];
    validateSchema(schemaDoc as never, schemaDoc as never, ordered as never, "", errors);
    if (errors.length > 0) {
      ordered = assemble({
        backend: doc.backend,
        irVersion: doc.irVersion,
        irHash: doc.irHash,
        method: doc.method,
        unavailable: { reason: `self-validation against deep-spec-findings-schema.json failed: ${errors[0]}` },
        findings: [],
        skipped: [],
      });
    }
  } catch (err) {
    ordered = assemble({
      backend: doc.backend,
      irVersion: doc.irVersion,
      irHash: doc.irHash,
      method: doc.method,
      unavailable: { reason: `findings schema unreadable: ${err instanceof Error ? err.message : String(err)}` },
      findings: [],
      skipped: [],
    });
  }
  writeFileSync(join(verifyDir, `${doc.backend}.json`), `${JSON.stringify(ordered, null, 2)}\n`, "utf-8");
  return {
    findingsCount: (ordered.findings as Json[]).length,
    skippedCount: (ordered.skipped as Json[]).length,
    unavailable: "unavailable" in ordered,
  };
}

// --- design cross-check ------------------------------------------------------
// Pure function of the design IR and every same-irHash sibling findings file:
// compares per-(unit, scenario) verdicts. Same convergence design as v1.

export function recomputeDesignCrossCheck(verifyDir: string, ir: DesignIr, irHash: string): void {
  interface SiblingDoc {
    backend: string;
    findings: DFinding[];
    skipped: Set<string>; // `${unit}|${target}`
  }
  const docs: SiblingDoc[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(verifyDir)
      .filter((f) => f.endsWith(".json") && f !== "cross-check.json")
      .sort();
  } catch {
    return;
  }
  for (const file of entries) {
    try {
      const raw = JSON.parse(readFileSync(join(verifyDir, file), "utf-8")) as Json;
      if (!isObject(raw) || raw.irHash !== irHash || isObject(raw.unavailable)) continue;
      const findings = (Array.isArray(raw.findings) ? raw.findings : []).filter(isObject) as unknown as DFinding[];
      const skipped = new Set<string>();
      for (const s of Array.isArray(raw.skipped) ? raw.skipped : []) {
        if (isObject(s) && typeof s.target === "string") {
          skipped.add(`${typeof s.unit === "string" ? s.unit : ""}|${s.target}`);
        }
      }
      docs.push({ backend: typeof raw.backend === "string" ? raw.backend : file.replace(/\.json$/, ""), findings, skipped });
    } catch {
      // Unreadable sibling — its own writer reports its state.
    }
  }
  const findings: DFinding[] = [];
  const comparedByBackend = new Map<string, Set<string>>();
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i];
      const b = docs[j];
      if (!a || !b) continue;
      for (const u of ir.units) {
        for (const sc of u.scenarios) {
          const key = `${u.unit}|${sc.id}`;
          if (a.skipped.has(key) || b.skipped.has(key)) continue;
          const verdictOf = (d: SiblingDoc): boolean =>
            d.findings.some((f) => f.kind === "scenario-violation" && f.unit === u.unit && Array.isArray(f.targets) && f.targets.includes(sc.id));
          const va = verdictOf(a);
          const vb = verdictOf(b);
          (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set()).get(a.backend))?.add(sc.id);
          (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set()).get(b.backend))?.add(sc.id);
          if (va !== vb) {
            const verdicts: { [k: string]: Json } = {};
            verdicts[a.backend] = va ? "violated" : "clean";
            verdicts[b.backend] = vb ? "violated" : "clean";
            findings.push({
              kind: "cross-check-disagreement",
              frRefs: sortedUnique(sc.frRefs, idCompare),
              targets: [sc.id],
              witness: { verdicts } as unknown as Json,
              unit: u.unit,
              detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id} of unit ${u.unit}. This signals a defect in the formalization or in a backend compiler, not in the design itself.`,
            });
          }
        }
      }
    }
  }
  const crossChecked = [...comparedByBackend.entries()]
    .map(([backend, targets]) => ({ backend, targets: [...targets].sort(idCompare) }))
    .sort((x, y) => (x.backend < y.backend ? -1 : x.backend > y.backend ? 1 : 0));
  writeDesignDoc(verifyDir, {
    backend: "cross-check",
    irVersion: ir.irVersion,
    irHash,
    method: "exhaustive",
    findings,
    skipped: [],
    crossChecked,
  });
}

export function designIrHashOf(raw: Json): string {
  return sha256(canonicalStringify(raw));
}
