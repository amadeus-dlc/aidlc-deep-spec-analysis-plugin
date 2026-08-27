// deep-spec-verify-smt sensor — SMT backend (z3, method: exhaustive).
//
// Deterministically compiles the deep-spec IR (contract 1) to SMT-LIB in
// TypeScript, executes z3 (z3-solver WASM) and writes normalized findings
// (contract 2) to <dirname(output)>/deep-spec-verify/smt.json.
//
// Checks (natures: invariant / event / numeric):
//   (a) conflict          — jointly unsatisfiable obligations, attributed to
//                           FR ids via unsat cores (global + antecedent
//                           vacuity + same-trigger contradictory effects);
//   (b) completeness-gap  — an input state no rule of a trigger covers;
//   (c) scenario check    — accept/reject examples verified by witness.
//
// Runtime notes: z3-solver's Emscripten pthread build aborts in-process
// under bun (verified 2026-08, bun 1.3.13), so solving always happens in a
// child process — `node` preferred, `bun` fallback — re-invoking this same
// file with --smt-child. Missing solver or runtime degrades to an
// `unavailable` findings file (never blocks the stage).
//
// Determinism: no timestamps; canonical sort of findings/skipped; fixed
// per-query solver timeout; identical IR + identical environment =>
// byte-identical output.
//
// Self-contained — no imports from the framework or sibling plugin tools.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND = "smt";
const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
const VERIFY_DIRNAME = "deep-spec-verify";
const IR_MAJOR_SUPPORTED = 1;
const PER_QUERY_TIMEOUT_MS = Number(process.env.AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS) || 2000;
const CHILD_BUDGET_MS = 45_000;
const CHILD_WALL_TIMEOUT_MS = 55_000;

// --- shared plumbing --------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface Expr {
  op: string;
  args?: Expr[];
  path?: string;
  prime?: boolean;
  value?: boolean | number | string;
}

interface AttrInfo {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
}

interface Obligation {
  id: string;
  nature: string;
  frRefs: string[];
  ears?: string;
  assert?: Expr;
  trigger?: string;
  guard?: Expr;
  effect?: Expr;
  temporal?: { pattern: string; assert?: Expr; from?: Expr; to?: Expr };
}

interface Scenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expr;
}

interface IrDoc {
  irVersion: string;
  attrs: AttrInfo[];
  obligations: Obligation[];
  scenarios: Scenario[];
  background: { id: string; assert: Expr }[];
}

interface Finding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: Json;
  detail: string;
}

interface Skipped {
  target: string;
  reason: string;
  detail?: string;
}

function parseFlags(argv: string[]): { stage: string; outputPath: string } {
  let stage = "";
  let outputPath = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") stage = argv[i + 1] ?? "";
    if (argv[i] === "--output-path") outputPath = argv[i + 1] ?? "";
  }
  return { stage, outputPath };
}

function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractJsonFence(md: string): string | null {
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

function canonicalStringify(value: Json): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

function numSegments(id: string): number[] {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}

function idCompare(a: string, b: string): number {
  const pa = a.replace(/[0-9.]/g, "");
  const pb = b.replace(/[0-9.]/g, "");
  if (pa !== pb) return pa < pb ? -1 : 1;
  const na = numSegments(a);
  const nb = numSegments(b);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const da = na[i] ?? -1;
    const db = nb[i] ?? -1;
    if (da !== db) return da - db;
  }
  return 0;
}

const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  "cross-check-disagreement": 3,
};

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const kr = (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9);
    if (kr !== 0) return kr;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

function sortSkipped(skipped: Skipped[]): Skipped[] {
  return [...skipped].sort((a, b) => {
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

function sortedUnique(values: string[], cmp: (a: string, b: string) => number): string[] {
  return [...new Set(values)].sort(cmp);
}

function parseIr(raw: Json): IrDoc | string {
  if (!isObject(raw)) return "IR is not a JSON object";
  const irVersion = typeof raw.irVersion === "string" ? raw.irVersion : "";
  if (!/^\d+\.\d+\.\d+$/.test(irVersion)) return "IR lacks a semver irVersion";
  const attrs: AttrInfo[] = [];
  const schema = isObject(raw.schema) ? raw.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
      const t = attr.type;
      const kind = t.kind;
      if (kind !== "bool" && kind !== "int" && kind !== "enum") continue;
      attrs.push({
        path: `${ent.name}.${attr.name}`,
        kind,
        min: typeof t.min === "number" ? t.min : undefined,
        max: typeof t.max === "number" ? t.max : undefined,
        values: Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined,
      });
    }
  }
  const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);
  const obligations: Obligation[] = [];
  for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
    obligations.push({
      id: ob.id,
      nature: ob.nature,
      frRefs: strArr(ob.frRefs),
      ears: typeof ob.ears === "string" ? ob.ears : undefined,
      assert: isObject(ob.assert) ? (ob.assert as unknown as Expr) : undefined,
      trigger: typeof ob.trigger === "string" ? ob.trigger : undefined,
      guard: isObject(ob.guard) ? (ob.guard as unknown as Expr) : undefined,
      effect: isObject(ob.effect) ? (ob.effect as unknown as Expr) : undefined,
      temporal: isObject(ob.temporal) ? (ob.temporal as unknown as Obligation["temporal"]) : undefined,
    });
  }
  const scenarios: Scenario[] = [];
  for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
    if (kind === null || !isObject(sc.bindings)) continue;
    const bindings: Scenario["bindings"] = {};
    for (const [k, v] of Object.entries(sc.bindings)) {
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
    }
    scenarios.push({
      id: sc.id,
      kind,
      frRefs: strArr(sc.frRefs),
      bindings,
      event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: sc.event.trigger } : undefined,
      expect: isObject(sc.expect) ? (sc.expect as unknown as Expr) : undefined,
    });
  }
  const background: IrDoc["background"] = [];
  for (const bg of Array.isArray(raw.background) ? raw.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
    background.push({ id: bg.id, assert: bg.assert as unknown as Expr });
  }
  return { irVersion, attrs, obligations, scenarios, background };
}

// --- findings document assembly + cross-check -------------------------------

interface FindingsDoc {
  backend: string;
  irVersion: string;
  irHash: string;
  method: string;
  unavailable?: { reason: string };
  findings: Finding[];
  skipped: Skipped[];
  crossChecked?: { backend: string; targets: string[] }[];
}

function writeFindingsDoc(verifyDir: string, doc: FindingsDoc): void {
  mkdirSync(verifyDir, { recursive: true });
  const ordered: { [k: string]: Json } = {
    backend: doc.backend,
    irVersion: doc.irVersion,
    irHash: doc.irHash,
    method: doc.method,
  };
  if (doc.unavailable) ordered.unavailable = doc.unavailable as unknown as Json;
  ordered.findings = doc.findings as unknown as Json;
  ordered.skipped = doc.skipped as unknown as Json;
  if (doc.crossChecked) ordered.crossChecked = doc.crossChecked as unknown as Json;
  writeFileSync(join(verifyDir, `${doc.backend}.json`), `${JSON.stringify(ordered, null, 2)}\n`, "utf-8");
}

// Recompute deep-spec-verify/cross-check.json as a pure function of the IR
// and every same-irHash backend findings file present. Every backend runs
// this after writing its own file; last writer wins and all writers converge
// on identical bytes, so the result is independent of sensor firing order.
// v1 comparable surface: scenario verdicts (the one check both backends
// implement with identical semantics). A disagreement signals a
// formalization or compiler defect — NOT a requirements defect.
function recomputeCrossCheck(verifyDir: string, ir: IrDoc, irHash: string): void {
  interface SiblingDoc {
    backend: string;
    findings: Finding[];
    skippedTargets: Set<string>;
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
      const findings = Array.isArray(raw.findings) ? (raw.findings as unknown as Finding[]) : [];
      const skippedTargets = new Set<string>();
      for (const s of Array.isArray(raw.skipped) ? raw.skipped : []) {
        if (isObject(s) && typeof s.target === "string") skippedTargets.add(s.target);
      }
      docs.push({ backend: typeof raw.backend === "string" ? raw.backend : file.replace(/\.json$/, ""), findings, skippedTargets });
    } catch {
      // Unreadable sibling — ignore; its own writer reports its state.
    }
  }
  const scenarioById = new Map(ir.scenarios.map((s) => [s.id, s]));
  const findings: Finding[] = [];
  const comparedByBackend = new Map<string, Set<string>>();
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i];
      const b = docs[j];
      if (!a || !b) continue;
      for (const sc of ir.scenarios) {
        if (a.skippedTargets.has(sc.id) || b.skippedTargets.has(sc.id)) continue;
        const va = a.findings.some((f) => f.kind === "scenario-violation" && f.targets.includes(sc.id));
        const vb = b.findings.some((f) => f.kind === "scenario-violation" && f.targets.includes(sc.id));
        (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set()).get(a.backend))?.add(sc.id);
        (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set()).get(b.backend))?.add(sc.id);
        if (va !== vb) {
          const verdicts: { [k: string]: Json } = {};
          verdicts[a.backend] = va ? "violated" : "clean";
          verdicts[b.backend] = vb ? "violated" : "clean";
          findings.push({
            kind: "cross-check-disagreement",
            frRefs: sortedUnique(scenarioById.get(sc.id)?.frRefs ?? [], idCompare),
            targets: [sc.id],
            witness: { verdicts },
            detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`,
          });
        }
      }
    }
  }
  const crossChecked = [...comparedByBackend.entries()]
    .map(([backend, targets]) => ({ backend, targets: [...targets].sort(idCompare) }))
    .sort((x, y) => (x.backend < y.backend ? -1 : x.backend > y.backend ? 1 : 0));
  writeFindingsDoc(verifyDir, {
    backend: "cross-check",
    irVersion: ir.irVersion,
    irHash,
    method: "exhaustive",
    findings: sortFindings(findings),
    skipped: [],
    crossChecked,
  });
}

// --- IR -> SMT-LIB compiler -------------------------------------------------

class CompileError extends Error {}

interface SmtCtx {
  attrByPath: Map<string, AttrInfo>;
}

function smtVar(path: string, primed: boolean): string {
  return `${primed ? "p" : "v"}_${path.replace(/\./g, "_")}`;
}

function smtName(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function enumCode(ctx: SmtCtx, attrPath: string, value: string): number {
  const attr = ctx.attrByPath.get(attrPath);
  if (!attr || attr.kind !== "enum" || !attr.values) {
    throw new CompileError(`"${attrPath}" is not an enum attribute`);
  }
  const idx = attr.values.indexOf(value);
  if (idx < 0) throw new CompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}

// Compiles an expression to an SMT-LIB s-expression. Enum literals are
// int-encoded and need a sibling ref for context, so binary comparisons
// resolve them against the referenced attribute's value list.
function smtOf(ctx: SmtCtx, e: Expr): string {
  const bin = (op: string): string => {
    const [a, b] = e.args ?? [];
    if (!a || !b) throw new CompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(ctx, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOf(ctx, a);
      const right = b === enumArg ? code : smtOf(ctx, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg) throw new CompileError("enum literal without a ref sibling has no resolvable encoding");
    return `(${op} ${smtOf(ctx, a)} ${smtOf(ctx, b)})`;
  };
  switch (e.op) {
    case "and":
    case "or":
      return `(${e.op} ${(e.args ?? []).map((a) => smtOf(ctx, a)).join(" ")})`;
    case "not":
      return `(not ${smtOf(ctx, (e.args ?? [])[0] as Expr)})`;
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
      if (typeof e.path !== "string" || !ctx.attrByPath.has(e.path)) {
        throw new CompileError(`unresolvable reference "${e.path ?? ""}"`);
      }
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n)) throw new CompileError("int literal is not an integer");
      return n < 0 ? `(- ${-n})` : String(n);
    }
    case "enum":
      throw new CompileError("enum literal without a ref sibling has no resolvable encoding");
    default:
      throw new CompileError(`unknown operator "${e.op}"`);
  }
}

function exprUsesPrime(e: Expr): boolean {
  if (e.op === "ref" && e.prime === true) return true;
  return (e.args ?? []).some(exprUsesPrime);
}

// --- query plan -------------------------------------------------------------

interface ChildQuery {
  id: string;
  script: string;
  assumptions: string[];
  model: { name: string; sort: "Int" | "Bool" }[];
}

interface ChildResult {
  id: string;
  status: "sat" | "unsat" | "unknown" | "budget" | "error";
  model?: { [name: string]: string };
  core?: string[];
  error?: string;
}

interface NamedConstraint {
  name: string;
  smt: string;
}

interface Plan {
  queries: ChildQuery[];
  compiled: Map<string, boolean>;
  skipped: Skipped[];
  labelToTarget: Map<string, string>;
  eventPairs: { qOverlap: string; qJoint: string; a: string; b: string; trigger: string }[];
  gapTriggers: Map<string, string[]>;
  scenarioQueries: Map<string, string>;
}

function buildPlan(ir: IrDoc): Plan {
  const ctx: SmtCtx = { attrByPath: new Map(ir.attrs.map((a) => [a.path, a])) };
  const skipped: Skipped[] = [];
  const compiled = new Map<string, boolean>();
  const labelToTarget = new Map<string, string>();

  const decls: string[] = [];
  const primedDecls: string[] = [];
  for (const attr of ir.attrs) {
    const sort = attr.kind === "bool" ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path, false)} ${sort})`);
    primedDecls.push(`(declare-const ${smtVar(attr.path, true)} ${sort})`);
  }

  const typeBounds: NamedConstraint[] = [];
  const primedTypeBounds: NamedConstraint[] = [];
  for (const attr of ir.attrs) {
    const bounds = (primed: boolean): string | null => {
      const v = smtVar(attr.path, primed);
      if (attr.kind === "enum" && attr.values) {
        return `(and (>= ${v} 0) (<= ${v} ${attr.values.length - 1}))`;
      }
      if (attr.kind === "int" && (attr.min !== undefined || attr.max !== undefined)) {
        const parts: string[] = [];
        if (attr.min !== undefined) parts.push(`(>= ${v} ${attr.min < 0 ? `(- ${-attr.min})` : attr.min})`);
        if (attr.max !== undefined) parts.push(`(<= ${v} ${attr.max < 0 ? `(- ${-attr.max})` : attr.max})`);
        return parts.length === 1 ? (parts[0] ?? null) : `(and ${parts.join(" ")})`;
      }
      return null;
    };
    const cur = bounds(false);
    if (cur) typeBounds.push({ name: smtName("ty", attr.path), smt: cur });
    const nxt = bounds(true);
    if (nxt) primedTypeBounds.push({ name: smtName("typ", attr.path), smt: nxt });
  }

  const bg: NamedConstraint[] = [];
  for (const b of ir.background) {
    try {
      bg.push({ name: smtName("bg", b.id), smt: smtOf(ctx, b.assert) });
      labelToTarget.set(smtName("bg", b.id), b.id);
    } catch (err) {
      // Background that does not compile is dropped from every query and
      // surfaced through the invariants' details; it has no OB/SC id of its
      // own so it cannot occupy skipped[].
      void err;
    }
  }

  const invariants: NamedConstraint[] = [];
  const invariantObs: Obligation[] = [];
  const events: Obligation[] = [];
  for (const ob of ir.obligations) {
    if (ob.nature === "invariant" || ob.nature === "numeric") {
      if (!ob.assert) {
        skipped.push({ target: ob.id, reason: "compile-error", detail: "invariant obligation lacks an assert expression" });
        compiled.set(ob.id, false);
        continue;
      }
      try {
        invariants.push({ name: smtName("ob", ob.id), smt: smtOf(ctx, ob.assert) });
        labelToTarget.set(smtName("ob", ob.id), ob.id);
        invariantObs.push(ob);
        compiled.set(ob.id, true);
      } catch (err) {
        skipped.push({ target: ob.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
        compiled.set(ob.id, false);
      }
    } else if (ob.nature === "event") {
      if (!ob.guard || !ob.effect || !ob.trigger) {
        skipped.push({ target: ob.id, reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" });
        compiled.set(ob.id, false);
        continue;
      }
      try {
        if (exprUsesPrime(ob.guard)) throw new CompileError("guard must not use primed references");
        smtOf(ctx, ob.guard);
        smtOf(ctx, ob.effect);
        events.push(ob);
        compiled.set(ob.id, true);
      } catch (err) {
        skipped.push({ target: ob.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
        compiled.set(ob.id, false);
      }
    } else {
      // state-temporal — outside this backend's nature coverage (FR6.2).
      skipped.push({ target: ob.id, reason: "capability", detail: `nature "${ob.nature}" is checked by a state-machine backend, not the SMT backend` });
      compiled.set(ob.id, false);
    }
  }

  const baseScript = [
    ...decls,
    ...[...typeBounds, ...bg, ...invariants].flatMap((c) => [
      `(declare-const ${c.name} Bool)`,
      `(assert (=> ${c.name} ${c.smt}))`,
    ]),
  ].join("\n");
  const baseAssumptions = [...typeBounds, ...bg, ...invariants].map((c) => c.name);
  const modelVars = ir.attrs.map((a) => ({
    name: smtVar(a.path, false),
    sort: (a.kind === "bool" ? "Bool" : "Int") as "Int" | "Bool",
  }));

  const queries: ChildQuery[] = [];

  // (a) global consistency of every invariant/numeric obligation.
  queries.push({ id: "global", script: baseScript, assumptions: baseAssumptions, model: modelVars });

  // (a) antecedent vacuity for implication-shaped invariants.
  for (const ob of invariantObs) {
    if (ob.assert?.op !== "implies") continue;
    const ant = (ob.assert.args ?? [])[0];
    if (!ant) continue;
    try {
      const name = smtName("ant", ob.id);
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${smtOf(ctx, ant)}))`].join("\n");
      queries.push({ id: `vac:${ob.id}`, script, assumptions: [...baseAssumptions, name], model: [] });
    } catch {
      // Antecedent compiled once already inside the full assert — unreachable.
    }
  }

  // (a) same-trigger event pairs with overlapping guards and contradictory effects.
  const eventPairs: Plan["eventPairs"] = [];
  const byTrigger = new Map<string, Obligation[]>();
  for (const ev of events) {
    const list = byTrigger.get(ev.trigger ?? "") ?? [];
    list.push(ev);
    byTrigger.set(ev.trigger ?? "", list);
  }
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b || !a.guard || !b.guard || !a.effect || !b.effect) continue;
        const ga = { name: smtName("g", a.id), smt: smtOf(ctx, a.guard) };
        const gb = { name: smtName("g", b.id), smt: smtOf(ctx, b.guard) };
        const ea = { name: smtName("e", a.id), smt: smtOf(ctx, a.effect) };
        const eb = { name: smtName("e", b.id), smt: smtOf(ctx, b.effect) };
        labelToTarget.set(ga.name, a.id);
        labelToTarget.set(gb.name, b.id);
        labelToTarget.set(ea.name, a.id);
        labelToTarget.set(eb.name, b.id);
        const overlapScript = [
          baseScript,
          ...[ga, gb].flatMap((c) => [`(declare-const ${c.name} Bool)`, `(assert (=> ${c.name} ${c.smt}))`]),
        ].join("\n");
        const jointScript = [
          baseScript,
          ...primedDecls,
          ...[...primedTypeBounds, ga, gb, ea, eb].flatMap((c) => [
            `(declare-const ${c.name} Bool)`,
            `(assert (=> ${c.name} ${c.smt}))`,
          ]),
        ].join("\n");
        const qOverlap = `evo:${a.id}:${b.id}`;
        const qJoint = `evj:${a.id}:${b.id}`;
        queries.push({ id: qOverlap, script: overlapScript, assumptions: [...baseAssumptions, ga.name, gb.name], model: [] });
        queries.push({
          id: qJoint,
          script: jointScript,
          assumptions: [...baseAssumptions, ...primedTypeBounds.map((c) => c.name), ga.name, gb.name, ea.name, eb.name],
          model: [],
        });
        eventPairs.push({ qOverlap, qJoint, a: a.id, b: b.id, trigger });
      }
    }
  }

  // (b) completeness gap per trigger: a legal state no guard covers.
  const gapTriggers = new Map<string, string[]>();
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    const guards = list.map((ev) => smtOf(ctx, ev.guard as Expr));
    const name = smtName("ng", trigger);
    const noGuard = guards.length === 1 ? `(not ${guards[0]})` : `(not (or ${guards.join(" ")}))`;
    const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${noGuard}))`].join("\n");
    queries.push({ id: `gap:${trigger}`, script, assumptions: [...baseAssumptions, name], model: modelVars });
    gapTriggers.set(
      trigger,
      list.map((ev) => ev.id).sort(idCompare),
    );
  }

  // (c) scenario checks — event-free scenarios only in v1.
  const scenarioQueries = new Map<string, string>();
  for (const sc of ir.scenarios) {
    if (sc.event) {
      skipped.push({ target: sc.id, reason: "capability", detail: "scenarios with a When-event are not checked by the SMT backend in v1" });
      continue;
    }
    try {
      const name = smtName("sc", sc.id);
      const parts: string[] = [];
      for (const [path, value] of Object.entries(sc.bindings).sort(([x], [y]) => (x < y ? -1 : 1))) {
        const attr = ctx.attrByPath.get(path);
        if (!attr) throw new CompileError(`binding references unknown attribute "${path}"`);
        const v = smtVar(path, false);
        if (attr.kind === "bool") parts.push(`(= ${v} ${value === true})`);
        else if (attr.kind === "int") {
          const n = typeof value === "number" ? value : Number.NaN;
          if (!Number.isInteger(n)) throw new CompileError(`binding for int attribute "${path}" is not an integer`);
          parts.push(`(= ${v} ${n < 0 ? `(- ${-n})` : n})`);
        } else parts.push(`(= ${v} ${enumCode(ctx, path, String(value))})`);
      }
      const conj = parts.length === 1 ? (parts[0] ?? "true") : `(and ${parts.join(" ")})`;
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${conj}))`].join("\n");
      const qid = `sc:${sc.id}`;
      queries.push({ id: qid, script, assumptions: [...baseAssumptions, name], model: modelVars });
      scenarioQueries.set(sc.id, qid);
    } catch (err) {
      skipped.push({ target: sc.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  return { queries, compiled, skipped, labelToTarget, eventPairs, gapTriggers, scenarioQueries };
}

// --- child (solver) side ----------------------------------------------------

async function childMain(): Promise<void> {
  let payload: { queries: ChildQuery[]; timeoutMs: number; budgetMs: number };
  try {
    payload = JSON.parse(readFileSync(0, "utf-8"));
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ unavailable: `child payload unreadable: ${err instanceof Error ? err.message : String(err)}` })}\n`);
    process.exit(0);
  }
  let api: {
    Context: (name: string) => unknown;
    em: { PThread: { terminateAllThreads: () => void } };
  };
  try {
    const mod = await import("z3-solver");
    api = (await mod.init()) as unknown as typeof api;
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ unavailable: `z3-solver is not available in this project: ${err instanceof Error ? err.message : String(err)}` })}\n`);
    process.exit(0);
  }
  // The high-level API is used untyped here: the plugin must not carry a
  // type dependency on z3-solver (it is an optional runtime).
  // biome-ignore lint/suspicious/noExplicitAny: optional runtime, no type dep
  const Z3 = api.Context("main") as any;
  const results: ChildResult[] = [];
  const started = Date.now();
  for (const q of payload.queries) {
    if (Date.now() - started > payload.budgetMs) {
      results.push({ id: q.id, status: "budget" });
      continue;
    }
    try {
      const solver = new Z3.Solver();
      solver.set("timeout", payload.timeoutMs);
      solver.fromString(q.script);
      const assumptions = q.assumptions.map((n: string) => Z3.Bool.const(n));
      const status = (await solver.check(...assumptions)) as string;
      if (status === "sat") {
        const model = solver.model();
        const values: { [name: string]: string } = {};
        for (const m of q.model) {
          const c = m.sort === "Bool" ? Z3.Bool.const(m.name) : Z3.Int.const(m.name);
          values[m.name] = model.eval(c, true).toString();
        }
        results.push({ id: q.id, status: "sat", model: values });
      } else if (status === "unsat") {
        const coreVec = solver.unsatCore();
        const core: string[] = [];
        const len = typeof coreVec.length === "function" ? coreVec.length() : 0;
        for (let i = 0; i < len; i++) core.push(coreVec.get(i).toString());
        results.push({ id: q.id, status: "unsat", core: core.sort() });
      } else {
        results.push({ id: q.id, status: "unknown" });
      }
    } catch (err) {
      results.push({ id: q.id, status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  process.stdout.write(`${JSON.stringify({ results })}\n`);
  try {
    api.em.PThread.terminateAllThreads();
  } catch {
    // Best-effort thread teardown; exit finishes the job.
  }
  process.exit(0);
}

// --- parent (sensor) side ---------------------------------------------------

interface ChildOutcome {
  results?: Map<string, ChildResult>;
  unavailable?: string;
}

function runChild(queries: ChildQuery[]): ChildOutcome {
  const self = fileURLToPath(import.meta.url);
  const payload = JSON.stringify({ queries, timeoutMs: PER_QUERY_TIMEOUT_MS, budgetMs: CHILD_BUDGET_MS });
  const override = process.env.AIDLC_DEEP_SPEC_SMT_RUNTIME;
  const runtimes = override ? [override] : ["node", "bun"];
  const attempts: string[] = [];
  for (const runtime of runtimes) {
    const res = spawnSync(runtime, [self, "--smt-child"], {
      input: payload,
      encoding: "utf-8",
      timeout: CHILD_WALL_TIMEOUT_MS,
      cwd: process.cwd(),
    });
    if (res.error && (res.error as NodeJS.ErrnoException).code === "ENOENT") {
      attempts.push(`${runtime}: not on PATH`);
      continue;
    }
    if (res.error || res.status !== 0) {
      const stderrTail = (res.stderr ?? "").trim().split("\n").slice(-2).join(" ").slice(0, 200);
      attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}${stderrTail ? ` (${stderrTail})` : ""}`);
      continue;
    }
    try {
      const parsed = JSON.parse((res.stdout ?? "").trim().split("\n").pop() ?? "");
      if (typeof parsed.unavailable === "string") return { unavailable: parsed.unavailable };
      const map = new Map<string, ChildResult>();
      for (const r of parsed.results ?? []) map.set(r.id, r);
      return { results: map };
    } catch {
      attempts.push(`${runtime}: solver child produced unreadable output`);
    }
  }
  return { unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
}

function decodeModel(ir: IrDoc, model: { [name: string]: string }): { [path: string]: Json } {
  const out: { [path: string]: Json } = {};
  for (const attr of [...ir.attrs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const raw = model[smtVar(attr.path, false)];
    if (raw === undefined) continue;
    if (attr.kind === "bool") {
      out[attr.path] = raw === "true";
    } else {
      const m = raw.match(/^\(-\s*(\d+)\)$/);
      const n = m ? -Number.parseInt(m[1] ?? "0", 10) : Number.parseInt(raw, 10);
      if (attr.kind === "enum" && attr.values) out[attr.path] = attr.values[n] ?? n;
      else out[attr.path] = n;
    }
  }
  return out;
}

function allTargets(ir: IrDoc): string[] {
  return [...ir.obligations.map((o) => o.id), ...ir.scenarios.map((s) => s.id)].sort(idCompare);
}

function frRefsOf(ir: IrDoc, targets: string[]): string[] {
  const refs: string[] = [];
  for (const t of targets) {
    for (const ob of ir.obligations) if (ob.id === t) refs.push(...ob.frRefs);
    for (const sc of ir.scenarios) if (sc.id === t) refs.push(...sc.frRefs);
  }
  return sortedUnique(refs, idCompare);
}

function parentMain(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-verify-smt: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== FORMAL_MODEL_BASENAME || !existsSync(flags.outputPath)) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  const verifyDir = join(dirname(flags.outputPath), VERIFY_DIRNAME);

  const fence = extractJsonFence(readFileSync(flags.outputPath, "utf-8"));
  let rawIr: Json = null;
  try {
    rawIr = fence === null ? null : (JSON.parse(fence) as Json);
  } catch {
    rawIr = null;
  }
  const parsed = rawIr === null ? "formal model does not contain exactly one readable ```json fence" : parseIr(rawIr);
  if (typeof parsed === "string") {
    writeFindingsDoc(verifyDir, {
      backend: BACKEND,
      irVersion: "0.0.0",
      irHash: sha256(""),
      method: "exhaustive",
      unavailable: { reason: `IR unreadable: ${parsed} — see the deep-spec-ir-valid sensor for details` },
      findings: [],
      skipped: [],
    });
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "ir-unreadable" })}\n`);
    process.exit(0);
  }
  const ir = parsed;
  const irHash = sha256(canonicalStringify(rawIr));

  const major = Number.parseInt(ir.irVersion.split(".")[0] ?? "", 10);
  if (major !== IR_MAJOR_SUPPORTED) {
    writeFindingsDoc(verifyDir, {
      backend: BACKEND,
      irVersion: ir.irVersion,
      irHash,
      method: "exhaustive",
      findings: [],
      skipped: sortSkipped(
        allTargets(ir).map((t) => ({
          target: t,
          reason: "ir-version-mismatch",
          detail: `IR major version ${major} is not supported by this backend (supports ${IR_MAJOR_SUPPORTED}.x.x)`,
        })),
      ),
    });
    recomputeCrossCheck(verifyDir, ir, irHash);
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "ir-version-mismatch" })}\n`);
    process.exit(0);
  }

  const plan = buildPlan(ir);
  const outcome = runChild(plan.queries);

  if (outcome.unavailable !== undefined || !outcome.results) {
    writeFindingsDoc(verifyDir, {
      backend: BACKEND,
      irVersion: ir.irVersion,
      irHash,
      method: "exhaustive",
      unavailable: { reason: outcome.unavailable ?? "solver child produced no results" },
      findings: [],
      skipped: sortSkipped([
        ...plan.skipped,
        ...allTargets(ir)
          .filter((t) => !plan.skipped.some((s) => s.target === t))
          .map((t) => ({ target: t, reason: "unavailable", detail: "z3 could not be executed" })),
      ]),
    });
    recomputeCrossCheck(verifyDir, ir, irHash);
    // 127 = tool-unavailable to the dispatcher; the findings file already
    // records the degradation for the stage.
    process.exit(127);
  }

  const results = outcome.results;
  const findings: Finding[] = [];
  const skipped: Skipped[] = [...plan.skipped];
  const conflictKeys = new Set<string>();
  const invariantIds = ir.obligations
    .filter((o) => (o.nature === "invariant" || o.nature === "numeric") && plan.compiled.get(o.id))
    .map((o) => o.id);

  const coreToTargets = (core: string[]): string[] => {
    const targets = core
      .map((label) => plan.labelToTarget.get(label))
      .filter((t): t is string => typeof t === "string" && t.startsWith("OB-"));
    return sortedUnique(targets, idCompare);
  };

  const addConflict = (targets: string[], core: string[], detail: string): void => {
    const effective = targets.length > 0 ? targets : invariantIds;
    if (effective.length === 0) return;
    const key = effective.join(",");
    if (conflictKeys.has(key)) return;
    conflictKeys.add(key);
    findings.push({
      kind: "conflict",
      frRefs: frRefsOf(ir, effective),
      targets: effective,
      witness: { core: core.sort() } as unknown as Json,
      detail,
    });
  };

  const timeoutSkip = (targets: string[], what: string): void => {
    for (const t of targets) {
      skipped.push({ target: t, reason: "timeout", detail: `${what} exceeded the solver budget` });
    }
  };

  // (a) global consistency.
  const global = results.get("global");
  let globallyUnsat = false;
  if (global?.status === "unsat") {
    globallyUnsat = true;
    addConflict(
      coreToTargets(global.core ?? []),
      global.core ?? [],
      "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.",
    );
  } else if (global && global.status !== "sat") {
    timeoutSkip(invariantIds, "global consistency check");
  }

  // (a) antecedent vacuity.
  if (!globallyUnsat) {
    for (const ob of ir.obligations) {
      const r = results.get(`vac:${ob.id}`);
      if (!r) continue;
      if (r.status === "unsat") {
        const targets = sortedUnique([...coreToTargets(r.core ?? []), ob.id], idCompare);
        addConflict(
          targets,
          r.core ?? [],
          `The condition of obligation ${ob.id} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`,
        );
      } else if (r.status !== "sat") {
        timeoutSkip([ob.id], `vacuity check for ${ob.id}`);
      }
    }
  }

  // (a) same-trigger contradictory effects.
  for (const pair of plan.eventPairs) {
    const overlap = results.get(pair.qOverlap);
    const joint = results.get(pair.qJoint);
    if (!overlap || !joint) continue;
    if (overlap.status === "sat" && joint.status === "unsat") {
      addConflict(
        sortedUnique([pair.a, pair.b], idCompare),
        joint.core ?? [],
        `Events ${pair.a} and ${pair.b} for trigger "${pair.trigger}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`,
      );
    } else if (overlap.status === "unknown" || overlap.status === "budget" || joint.status === "unknown" || joint.status === "budget") {
      timeoutSkip([pair.a, pair.b], `event-pair check for trigger "${pair.trigger}"`);
    }
  }

  // (b) completeness gaps.
  for (const [trigger, eventIds] of [...plan.gapTriggers.entries()].sort()) {
    const r = results.get(`gap:${trigger}`);
    if (!r) continue;
    if (r.status === "sat") {
      findings.push({
        kind: "completeness-gap",
        frRefs: frRefsOf(ir, eventIds),
        targets: eventIds,
        witness: { model: decodeModel(ir, r.model ?? {}) } as unknown as Json,
        detail: `No rule for trigger "${trigger}" applies to the witness state: the behavior of this input region is unspecified.`,
      });
    } else if (r.status !== "unsat") {
      timeoutSkip(eventIds, `completeness check for trigger "${trigger}"`);
    }
  }

  // (c) scenarios.
  for (const sc of ir.scenarios) {
    const qid = plan.scenarioQueries.get(sc.id);
    if (!qid) continue;
    const r = results.get(qid);
    if (!r) continue;
    if (r.status === "unknown" || r.status === "budget" || r.status === "error") {
      timeoutSkip([sc.id], `scenario check for ${sc.id}`);
      continue;
    }
    if (sc.kind === "accept" && r.status === "unsat") {
      const targets = sortedUnique([sc.id, ...coreToTargets(r.core ?? [])], idCompare);
      findings.push({
        kind: "scenario-violation",
        frRefs: frRefsOf(ir, targets),
        targets,
        witness: { core: (r.core ?? []).sort() } as unknown as Json,
        detail: `Accept scenario ${sc.id} describes a state the obligations in the witness core rule out — the requirements reject an example that should be accepted.`,
      });
    }
    if (sc.kind === "reject" && r.status === "sat") {
      findings.push({
        kind: "scenario-violation",
        frRefs: frRefsOf(ir, [sc.id]),
        targets: [sc.id],
        witness: { model: decodeModel(ir, r.model ?? {}) } as unknown as Json,
        detail: `Reject scenario ${sc.id} is still satisfiable — the requirements do not exclude an example that should be rejected (witness state attached).`,
      });
    }
  }

  const doc: FindingsDoc = {
    backend: BACKEND,
    irVersion: ir.irVersion,
    irHash,
    method: "exhaustive",
    findings: sortFindings(findings),
    skipped: sortSkipped(skipped),
  };
  writeFindingsDoc(verifyDir, doc);
  recomputeCrossCheck(verifyDir, ir, irHash);

  process.stdout.write(
    `${JSON.stringify({ pass: doc.findings.length === 0, findings_count: doc.findings.length, skipped_count: doc.skipped.length, method: "exhaustive" })}\n`,
  );
  process.exit(0);
}

if (process.argv.includes("--smt-child")) {
  await childMain();
} else {
  parentMain();
}
