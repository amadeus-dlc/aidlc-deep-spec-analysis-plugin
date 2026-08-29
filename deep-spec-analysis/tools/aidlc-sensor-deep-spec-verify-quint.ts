// deep-spec-verify-quint sensor — Quint backend (state machines).
//
// Deterministically compiles the deep-spec IR (contract 1) to Quint in
// TypeScript, shells out to the `quint` CLI, and writes normalized findings
// (contract 2) to <dirname(output)>/deep-spec-verify/quint.json.
//
// Coverage (natures: state-temporal, plus events with a bounded state
// schema): invariant preservation under the event machine (reachable
// violations => kind: conflict with a step trace witness), deadlocked legal
// states (kind: completeness-gap), leads-to temporal obligations (bounded
// mode only), and fully-bound event-free scenarios (the cross-check surface
// shared with the SMT backend).
//
// Method (FR7.3): `quint verify` (Apalache, method: bounded) when Java and
// an Apalache distribution are detected; otherwise `quint run` with a fixed
// seed (method: simulation). Override with
// AIDLC_DEEP_SPEC_QUINT_METHOD=auto|bounded|simulation.
//
// Determinism: fixed seed, fixed step/sample budgets, ITF metadata
// stripped, canonical sorting; identical IR + identical environment =>
// byte-identical output.
//
// Self-contained from the framework's point of view — no imports from the
// framework or its core tools; the only import is the plugin's own bundled
// deep-spec-lib.ts, which ships in the same compose delta (contract-2
// self-validation).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "./kernel/adapter/index.ts";

const BACKEND = "quint";
const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
const VERIFY_DIRNAME = "deep-spec-verify";
const IR_MAJOR_SUPPORTED = 1;
const SEED = "0x2a";
const MAX_STEPS = 8;
const MAX_SAMPLES = 200;
const RUN_TIMEOUT_MS = 30_000;
const VERIFY_TIMEOUT_MS = 45_000;
const SCENARIO_TIMEOUT_MS = 15_000;

// --- shared plumbing (kept in sync with the sibling backend tools) ----------

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
  const assemble = (d: FindingsDoc): { [k: string]: Json } => {
    const ordered: { [k: string]: Json } = {
      backend: d.backend,
      irVersion: d.irVersion,
      irHash: d.irHash,
      method: d.method,
    };
    if (d.unavailable) ordered.unavailable = d.unavailable as unknown as Json;
    ordered.findings = d.findings as unknown as Json;
    ordered.skipped = d.skipped as unknown as Json;
    if (d.crossChecked) ordered.crossChecked = d.crossChecked as unknown as Json;
    return ordered;
  };
  // Contract-2 self-validation: a writer must never emit a non-conforming
  // findings file. On failure the document degrades to `unavailable` with
  // the validation error as the reason — never a silently-invalid file.
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
  writeFileSync(join(verifyDir, `${doc.backend}.json`), `${JSON.stringify(ordered, null, 2)}
`, "utf-8");
}

// Recompute deep-spec-verify/cross-check.json as a pure function of the IR
// and every same-irHash backend findings file present. Kept byte-identical
// with the implementation in the sibling backend tools; see the SMT tool for
// the design rationale (order-independent convergence).
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

// --- IR -> Quint compiler ---------------------------------------------------

class CompileError extends Error {}

function qVar(path: string): string {
  return path.replace(/\./g, "_");
}

function qId(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function qLit(value: boolean | number | string): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

// Compiles an expression to Quint. `name` maps an attribute path to the
// Quint expression that denotes it (state var, nondet temp, or primed var).
function quintOf(e: Expr, name: (path: string, primed: boolean) => string): string {
  const args = (e.args ?? []).map((a) => quintOf(a, name));
  const two = (): [string, string] => {
    if (args.length !== 2) throw new CompileError(`operator "${e.op}" needs two arguments`);
    return [args[0] ?? "", args[1] ?? ""];
  };
  switch (e.op) {
    case "and":
      return `and(${args.join(", ")})`;
    case "or":
      return `or(${args.join(", ")})`;
    case "not":
      return `not(${args[0] ?? ""})`;
    case "implies": {
      const [a, b] = two();
      return `(${a} implies ${b})`;
    }
    case "iff": {
      const [a, b] = two();
      return `(${a} iff ${b})`;
    }
    case "eq": {
      const [a, b] = two();
      return `(${a} == ${b})`;
    }
    case "ne": {
      const [a, b] = two();
      return `(${a} != ${b})`;
    }
    case "lt": {
      const [a, b] = two();
      return `(${a} < ${b})`;
    }
    case "le": {
      const [a, b] = two();
      return `(${a} <= ${b})`;
    }
    case "gt": {
      const [a, b] = two();
      return `(${a} > ${b})`;
    }
    case "ge": {
      const [a, b] = two();
      return `(${a} >= ${b})`;
    }
    case "add": {
      const [a, b] = two();
      return `(${a} + ${b})`;
    }
    case "sub": {
      const [a, b] = two();
      return `(${a} - ${b})`;
    }
    case "mul": {
      const [a, b] = two();
      return `(${a} * ${b})`;
    }
    case "ref":
      if (typeof e.path !== "string") throw new CompileError("ref without path");
      return name(e.path, e.prime === true);
    case "bool":
    case "int":
    case "enum":
      if (e.value === undefined) throw new CompileError(`${e.op} literal without value`);
      return qLit(e.value);
    default:
      throw new CompileError(`unknown operator "${e.op}"`);
  }
}

// Decomposes an event effect into primed assignments: the effect must be a
// conjunction of eq(prime(ref), <prime-free expr>) terms, each path assigned
// once. This is the assignment form both Quint and determinism require.
function decomposeEffect(effect: Expr): Map<string, Expr> {
  const assignments = new Map<string, Expr>();
  const terms: Expr[] = [];
  const flatten = (e: Expr): void => {
    if (e.op === "and") {
      for (const a of e.args ?? []) flatten(a);
    } else {
      terms.push(e);
    }
  };
  flatten(effect);
  for (const term of terms) {
    if (term.op !== "eq") throw new CompileError("effect must be a conjunction of primed assignments (eq(prime-ref, expr))");
    const [a, b] = term.args ?? [];
    const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
    const rhs = target === a ? b : a;
    if (!target || !rhs || typeof target.path !== "string") {
      throw new CompileError("effect must be a conjunction of primed assignments (eq(prime-ref, expr))");
    }
    if (usesPrime(rhs)) throw new CompileError("assignment right-hand side must not use primed references");
    if (assignments.has(target.path)) throw new CompileError(`attribute "${target.path}" assigned twice in one effect`);
    assignments.set(target.path, rhs);
  }
  return assignments;
}

function usesPrime(e: Expr): boolean {
  if (e.op === "ref" && e.prime === true) return true;
  return (e.args ?? []).some(usesPrime);
}

interface MachineComponent {
  id: string;
  expr: Expr;
  frRefs: string[];
}

interface CompiledMachine {
  moduleText: string;
  invariantComponents: MachineComponent[];
  eventIds: string[];
  temporalIds: string[];
  scenarioInits: Map<string, string>;
  varToPath: Map<string, string>;
}

function domainOf(attr: AttrInfo): string {
  if (attr.kind === "bool") return "Set(true, false)";
  if (attr.kind === "enum") return `Set(${(attr.values ?? []).map((v) => JSON.stringify(v)).join(", ")})`;
  if (attr.min === undefined || attr.max === undefined) {
    throw new CompileError(`int attribute "${attr.path}" lacks min/max — bounded domains are required by the quint backend`);
  }
  return `(${attr.min}).to(${attr.max})`;
}

function quintType(attr: AttrInfo): string {
  if (attr.kind === "bool") return "bool";
  if (attr.kind === "int") return "int";
  return "str";
}

function compileMachine(ir: IrDoc, skipped: Skipped[]): CompiledMachine {
  const attrByPath = new Map(ir.attrs.map((a) => [a.path, a]));
  const varToPath = new Map<string, string>();
  for (const attr of ir.attrs) {
    const v = qVar(attr.path);
    if (varToPath.has(v)) throw new CompileError(`state variable name collision: "${v}"`);
    varToPath.set(v, attr.path);
  }
  const stateName = (path: string, primed: boolean): string => {
    if (!attrByPath.has(path)) throw new CompileError(`unresolvable reference "${path}"`);
    if (primed) throw new CompileError("primed reference outside an effect");
    return qVar(path);
  };

  // Every attribute needs a finite domain before the machine can exist.
  for (const attr of ir.attrs) domainOf(attr);

  const lines: string[] = ["module main {"];
  for (const attr of ir.attrs) lines.push(`  var ${qVar(attr.path)}: ${quintType(attr)}`);
  lines.push("");

  // Invariant surface: invariant/numeric obligations, state-temporal
  // "always" obligations, background constraints, and type bounds.
  const invariantComponents: MachineComponent[] = [];
  const temporalIds: string[] = [];
  for (const ob of ir.obligations) {
    if ((ob.nature === "invariant" || ob.nature === "numeric") && ob.assert) {
      invariantComponents.push({ id: ob.id, expr: ob.assert, frRefs: ob.frRefs });
    }
    if (ob.nature === "state-temporal" && ob.temporal?.pattern === "always" && ob.temporal.assert) {
      invariantComponents.push({ id: ob.id, expr: ob.temporal.assert, frRefs: ob.frRefs });
    }
    if (ob.nature === "state-temporal" && ob.temporal?.pattern === "leads-to") {
      temporalIds.push(ob.id);
    }
  }
  const bgComponents: MachineComponent[] = ir.background.map((b) => ({ id: b.id, expr: b.assert, frRefs: [] }));

  const invExprs: string[] = [];
  for (const c of [...invariantComponents, ...bgComponents]) {
    const def = qId("prop", c.id);
    lines.push(`  val ${def} = ${quintOf(c.expr, stateName)}`);
    invExprs.push(def);
  }
  const boundExprs: string[] = [];
  for (const attr of ir.attrs) {
    if (attr.kind === "int") {
      boundExprs.push(`(${qVar(attr.path)} >= ${attr.min} and ${qVar(attr.path)} <= ${attr.max})`);
    } else if (attr.kind === "enum") {
      boundExprs.push(`${domainOf(attr)}.contains(${qVar(attr.path)})`);
    }
  }
  const invAllParts = [...invExprs, ...boundExprs];
  lines.push(`  val invAll = ${invAllParts.length > 0 ? `and(${invAllParts.join(", ")})` : "true"}`);
  lines.push("");

  // init: any state satisfying domains, background, and invariants.
  lines.push("  action init = {");
  for (const attr of ir.attrs) {
    lines.push(`    nondet n_${qVar(attr.path)} = ${domainOf(attr)}.oneOf()`);
  }
  const initName = (path: string, primed: boolean): string => {
    if (primed) throw new CompileError("primed reference outside an effect");
    if (!attrByPath.has(path)) throw new CompileError(`unresolvable reference "${path}"`);
    return `n_${qVar(path)}`;
  };
  const initConds = [...invariantComponents, ...bgComponents].map((c) => quintOf(c.expr, initName));
  lines.push("    all {");
  for (const cond of initConds) lines.push(`      ${cond},`);
  for (const attr of ir.attrs) lines.push(`      ${qVar(attr.path)}' = n_${qVar(attr.path)},`);
  lines.push("      true");
  lines.push("    }");
  lines.push("  }");
  lines.push("");

  // Events -> actions with an explicit frame (unmentioned vars unchanged).
  const eventIds: string[] = [];
  const actionNames: string[] = [];
  for (const ob of ir.obligations) {
    if (ob.nature !== "event") continue;
    if (!ob.guard || !ob.effect || !ob.trigger) {
      skipped.push({ target: ob.id, reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" });
      continue;
    }
    try {
      if (usesPrime(ob.guard)) throw new CompileError("guard must not use primed references");
      const guard = quintOf(ob.guard, stateName);
      const assignments = decomposeEffect(ob.effect);
      const action = qId("ev", ob.id);
      const parts: string[] = [guard];
      for (const attr of ir.attrs) {
        const rhs = assignments.get(attr.path);
        parts.push(`${qVar(attr.path)}' = ${rhs ? quintOf(rhs, stateName) : qVar(attr.path)}`);
      }
      lines.push(`  action ${action} = all { ${parts.join(", ")} }`);
      actionNames.push(action);
      eventIds.push(ob.id);
    } catch (err) {
      skipped.push({ target: ob.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  const idleParts = ir.attrs.map((a) => `${qVar(a.path)}' = ${qVar(a.path)}`);
  lines.push(`  action idle = all { ${idleParts.join(", ")} }`);
  lines.push(`  action step = any { ${actionNames.length > 0 ? actionNames.join(", ") : "idle"} }`);
  lines.push("");

  // Temporal (leads-to) properties, bounded mode only.
  for (const ob of ir.obligations) {
    if (ob.nature !== "state-temporal" || ob.temporal?.pattern !== "leads-to") continue;
    if (!ob.temporal.from || !ob.temporal.to) continue;
    try {
      const from = quintOf(ob.temporal.from, stateName);
      const to = quintOf(ob.temporal.to, stateName);
      lines.push(`  temporal ${qId("temp", ob.id)} = always(${from} implies eventually(${to}))`);
    } catch (err) {
      skipped.push({ target: ob.id, reason: "compile-error", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  lines.push("");

  // Scenario inits: fully-bound, event-free scenarios only.
  const scenarioInits = new Map<string, string>();
  for (const sc of ir.scenarios) {
    if (sc.event) continue;
    const boundPaths = new Set(Object.keys(sc.bindings));
    if (ir.attrs.some((a) => !boundPaths.has(a.path))) continue;
    const parts: string[] = [];
    let ok = true;
    for (const attr of ir.attrs) {
      const value = sc.bindings[attr.path];
      if (value === undefined) {
        ok = false;
        break;
      }
      parts.push(`${qVar(attr.path)}' = ${qLit(value)}`);
    }
    if (!ok) continue;
    const initAction = qId("scInit", sc.id);
    lines.push(`  action ${initAction} = all { ${parts.join(", ")} }`);
    scenarioInits.set(sc.id, initAction);
  }

  lines.push("}");
  return { moduleText: `${lines.join("\n")}\n`, invariantComponents, eventIds, temporalIds, scenarioInits, varToPath };
}

// --- ITF trace decoding and pure evaluation for attribution -----------------

function decodeItfValue(v: Json): Json {
  if (isObject(v) && typeof v["#bigint"] === "string") return Number.parseInt(v["#bigint"], 10);
  return v;
}

function decodeItfTrace(itfText: string, varToPath: Map<string, string>): { [path: string]: Json }[] {
  const doc = JSON.parse(itfText) as Json;
  if (!isObject(doc) || !Array.isArray(doc.states)) return [];
  const trace: { [path: string]: Json }[] = [];
  for (const state of doc.states) {
    if (!isObject(state)) continue;
    const decoded: { [path: string]: Json } = {};
    for (const key of Object.keys(state).sort()) {
      if (key.startsWith("#")) continue;
      const path = varToPath.get(key) ?? key;
      decoded[path] = decodeItfValue(state[key] ?? null);
    }
    trace.push(decoded);
  }
  return trace;
}

function itfStatus(itfText: string): string {
  try {
    const doc = JSON.parse(itfText) as Json;
    if (isObject(doc) && isObject(doc["#meta"]) && typeof doc["#meta"].status === "string") {
      return doc["#meta"].status;
    }
  } catch {
    // fallthrough
  }
  return "";
}

function evalExpr(e: Expr, state: { [path: string]: Json }): Json {
  const arg = (i: number): Json => evalExpr((e.args ?? [])[i] as Expr, state);
  const asBool = (v: Json): boolean => v === true;
  const asNum = (v: Json): number => (typeof v === "number" ? v : Number.NaN);
  switch (e.op) {
    case "and":
      return (e.args ?? []).every((a) => asBool(evalExpr(a, state)));
    case "or":
      return (e.args ?? []).some((a) => asBool(evalExpr(a, state)));
    case "not":
      return !asBool(arg(0));
    case "implies":
      return !asBool(arg(0)) || asBool(arg(1));
    case "iff":
      return asBool(arg(0)) === asBool(arg(1));
    case "eq":
      return JSON.stringify(arg(0)) === JSON.stringify(arg(1));
    case "ne":
      return JSON.stringify(arg(0)) !== JSON.stringify(arg(1));
    case "lt":
      return asNum(arg(0)) < asNum(arg(1));
    case "le":
      return asNum(arg(0)) <= asNum(arg(1));
    case "gt":
      return asNum(arg(0)) > asNum(arg(1));
    case "ge":
      return asNum(arg(0)) >= asNum(arg(1));
    case "add":
      return asNum(arg(0)) + asNum(arg(1));
    case "sub":
      return asNum(arg(0)) - asNum(arg(1));
    case "mul":
      return asNum(arg(0)) * asNum(arg(1));
    case "ref":
      return state[e.path ?? ""] ?? null;
    case "bool":
    case "int":
    case "enum":
      return e.value ?? null;
    default:
      return null;
  }
}

// --- quint CLI orchestration ------------------------------------------------

interface QuintRun {
  ok: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  itf: string | null;
}

function quintBin(): string {
  return process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint";
}

function runQuint(args: string[], itfPath: string | null, timeoutMs: number, cwd: string): QuintRun {
  const res = spawnSync(quintBin(), args, { encoding: "utf-8", timeout: timeoutMs, cwd });
  const timedOut = res.signal === "SIGTERM" || res.signal === "SIGKILL";
  let itf: string | null = null;
  if (itfPath && existsSync(itfPath)) {
    try {
      itf = readFileSync(itfPath, "utf-8");
    } catch {
      itf = null;
    }
  }
  return { ok: !res.error && !timedOut, timedOut, stdout: res.stdout ?? "", stderr: res.stderr ?? "", itf };
}

function detectBoundedMode(): boolean {
  const override = process.env.AIDLC_DEEP_SPEC_QUINT_METHOD;
  if (override === "bounded") return true;
  if (override === "simulation") return false;
  const java = spawnSync("java", ["-version"], { encoding: "utf-8", timeout: 10_000 });
  if (java.error || java.status !== 0) return false;
  if (process.env.APALACHE_DIST) return true;
  try {
    const home = process.env.HOME ?? "";
    return readdirSync(join(home, ".quint")).some((f) => f.startsWith("apalache-dist-"));
  } catch {
    return false;
  }
}

// --- main -------------------------------------------------------------------

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

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-verify-quint: --output-path is required\n");
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
      method: "simulation",
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
      method: "simulation",
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

  // quint CLI availability.
  const probe = spawnSync(quintBin(), ["--version"], { encoding: "utf-8", timeout: 15_000 });
  if (probe.error || probe.status !== 0) {
    writeFindingsDoc(verifyDir, {
      backend: BACKEND,
      irVersion: ir.irVersion,
      irHash,
      method: "simulation",
      unavailable: { reason: `quint CLI is not available (install: npm i -g @informalsystems/quint)` },
      findings: [],
      skipped: sortSkipped(allTargets(ir).map((t) => ({ target: t, reason: "unavailable", detail: "quint CLI missing" }))),
    });
    recomputeCrossCheck(verifyDir, ir, irHash);
    process.exit(127);
  }

  const bounded = detectBoundedMode();
  const method = bounded ? "bounded" : "simulation";
  const skipped: Skipped[] = [];
  const findings: Finding[] = [];

  let machine: CompiledMachine | null = null;
  let machineError = "";
  try {
    machine = compileMachine(ir, skipped);
  } catch (err) {
    machineError = err instanceof Error ? err.message : String(err);
  }

  if (machine === null) {
    // The whole machine is uncompilable (unbounded ints, name collisions):
    // every obligation this backend would check is skipped with the reason.
    for (const ob of ir.obligations) {
      skipped.push({ target: ob.id, reason: "compile-error", detail: machineError });
    }
    for (const sc of ir.scenarios) {
      skipped.push({ target: sc.id, reason: "compile-error", detail: machineError });
    }
    writeFindingsDoc(verifyDir, {
      backend: BACKEND,
      irVersion: ir.irVersion,
      irHash,
      method,
      findings: [],
      skipped: sortSkipped(skipped),
    });
    recomputeCrossCheck(verifyDir, ir, irHash);
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "machine-uncompilable" })}\n`);
    process.exit(0);
  }

  const work = mkdtempSync(join(tmpdir(), "deep-spec-quint-"));
  const modulePath = join(work, "main.qnt");
  writeFileSync(modulePath, machine.moduleText, "utf-8");

  const machineTargets = sortedUnique(
    [...machine.invariantComponents.map((c) => c.id), ...machine.eventIds],
    idCompare,
  );

  try {
    // 1) Reachable invariant violations under the event machine.
    if (machine.invariantComponents.length > 0) {
      const itfPath = join(work, "machine.itf.json");
      const run = bounded
        ? runQuint(
            ["verify", modulePath, "--main=main", "--invariant=invAll", `--max-steps=${MAX_STEPS}`, `--out-itf=${itfPath}`],
            itfPath,
            VERIFY_TIMEOUT_MS,
            work,
          )
        : runQuint(
            [
              "run",
              modulePath,
              "--main=main",
              "--invariant=invAll",
              `--seed=${SEED}`,
              `--max-samples=${MAX_SAMPLES}`,
              `--max-steps=${MAX_STEPS}`,
              `--out-itf=${itfPath}`,
            ],
            itfPath,
            RUN_TIMEOUT_MS,
            work,
          );
      if (run.timedOut) {
        for (const t of machineTargets) {
          skipped.push({ target: t, reason: "timeout", detail: "machine invariant check exceeded its budget" });
        }
      } else if (`${run.stdout}\n${run.stderr}`.toLowerCase().includes("deadlock")) {
        findings.push({
          kind: "completeness-gap",
          frRefs: frRefsOf(ir, machine.eventIds),
          targets: machine.eventIds.length > 0 ? [...machine.eventIds].sort(idCompare) : machineTargets,
          witness: run.itf
            ? ({ trace: decodeItfTrace(run.itf, machine.varToPath) } as unknown as Json)
            : ({ model: {} } as unknown as Json),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
        });
      } else {
        const violated = run.itf !== null && (itfStatus(run.itf) === "violation" || (bounded && !!run.itf));
        const failedUnexpectedly = !violated && run.itf === null && `${run.stdout}${run.stderr}`.includes("error");
        if (violated && run.itf) {
          const trace = decodeItfTrace(run.itf, machine.varToPath);
          const finalState = trace[trace.length - 1] ?? {};
          const violatedComponents = machine.invariantComponents.filter((c) => evalExpr(c.expr, finalState) !== true);
          const targets =
            violatedComponents.length > 0
              ? sortedUnique(violatedComponents.map((c) => c.id), idCompare)
              : [...machine.eventIds].sort(idCompare);
          findings.push({
            kind: "conflict",
            frRefs: frRefsOf(ir, sortedUnique([...targets, ...machine.eventIds], idCompare)),
            targets,
            witness: { trace } as unknown as Json,
            detail: `The event machine can reach a state that violates ${targets.join(", ")} (step trace attached): the event rules do not preserve the obligation.`,
          });
        } else if (failedUnexpectedly) {
          for (const t of machineTargets) {
            skipped.push({
              target: t,
              reason: "unavailable",
              detail: `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${`${run.stderr}${run.stdout}`.trim().split("\n").pop()?.slice(0, 200) ?? ""}`,
            });
          }
        }
      }
    }

    // 2) leads-to temporal obligations.
    for (const ob of ir.obligations) {
      if (ob.nature !== "state-temporal" || ob.temporal?.pattern !== "leads-to") continue;
      if (skipped.some((s) => s.target === ob.id)) continue;
      if (!bounded) {
        skipped.push({
          target: ob.id,
          reason: "capability",
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
        });
        continue;
      }
      const itfPath = join(work, `${qId("temp", ob.id)}.itf.json`);
      const run = runQuint(
        ["verify", modulePath, "--main=main", `--temporal=${qId("temp", ob.id)}`, `--max-steps=${MAX_STEPS}`, `--out-itf=${itfPath}`],
        itfPath,
        VERIFY_TIMEOUT_MS,
        work,
      );
      if (run.timedOut) {
        skipped.push({ target: ob.id, reason: "timeout", detail: "temporal check exceeded its budget" });
      } else if (run.itf) {
        findings.push({
          kind: "conflict",
          frRefs: frRefsOf(ir, [ob.id]),
          targets: [ob.id],
          witness: { trace: decodeItfTrace(run.itf, machine.varToPath) } as unknown as Json,
          detail: `Temporal obligation ${ob.id} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`,
        });
      }
    }

    // 3) Scenario checks (fully-bound, event-free): the cross-check surface.
    for (const sc of ir.scenarios) {
      if (sc.event) {
        skipped.push({ target: sc.id, reason: "capability", detail: "scenarios with a When-event are not checked by the quint backend in v1" });
        continue;
      }
      const initAction = machine.scenarioInits.get(sc.id);
      if (!initAction) {
        skipped.push({
          target: sc.id,
          reason: "capability",
          detail: "quint scenario evaluation requires bindings for every declared attribute",
        });
        continue;
      }
      const itfPath = join(work, `${qId("sc", sc.id)}.itf.json`);
      const run = runQuint(
        [
          "run",
          modulePath,
          "--main=main",
          `--init=${initAction}`,
          "--step=idle",
          "--invariant=invAll",
          "--max-steps=1",
          "--max-samples=1",
          `--seed=${SEED}`,
          `--out-itf=${itfPath}`,
        ],
        itfPath,
        SCENARIO_TIMEOUT_MS,
        work,
      );
      if (run.timedOut || (!run.itf && `${run.stdout}${run.stderr}`.includes("error"))) {
        skipped.push({
          target: sc.id,
          reason: run.timedOut ? "timeout" : "unavailable",
          detail: run.timedOut
            ? "scenario evaluation exceeded its budget"
            : `quint run failed unexpectedly: ${`${run.stderr}${run.stdout}`.trim().split("\n").pop()?.slice(0, 200) ?? ""}`,
        });
        continue;
      }
      const violated = run.itf !== null && itfStatus(run.itf) === "violation";
      const state: { [path: string]: Json } = {};
      for (const [path, value] of Object.entries(sc.bindings)) state[path] = value;
      if (sc.kind === "accept" && violated) {
        const violatedComponents = machine.invariantComponents.filter((c) => evalExpr(c.expr, state) !== true);
        const targets = sortedUnique([sc.id, ...violatedComponents.map((c) => c.id)], idCompare);
        findings.push({
          kind: "scenario-violation",
          frRefs: frRefsOf(ir, targets),
          targets,
          witness: { model: state } as unknown as Json,
          detail: `Accept scenario ${sc.id} describes a state the obligations rule out — the requirements reject an example that should be accepted.`,
        });
      }
      if (sc.kind === "reject" && !violated) {
        findings.push({
          kind: "scenario-violation",
          frRefs: frRefsOf(ir, [sc.id]),
          targets: [sc.id],
          witness: { model: state } as unknown as Json,
          detail: `Reject scenario ${sc.id} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
        });
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const doc: FindingsDoc = {
    backend: BACKEND,
    irVersion: ir.irVersion,
    irHash,
    method,
    findings: sortFindings(findings),
    skipped: sortSkipped(skipped),
  };
  writeFindingsDoc(verifyDir, doc);
  recomputeCrossCheck(verifyDir, ir, irHash);

  process.stdout.write(
    `${JSON.stringify({ pass: doc.findings.length === 0, findings_count: doc.findings.length, skipped_count: doc.skipped.length, method })}\n`,
  );
  process.exit(0);
}

main();
