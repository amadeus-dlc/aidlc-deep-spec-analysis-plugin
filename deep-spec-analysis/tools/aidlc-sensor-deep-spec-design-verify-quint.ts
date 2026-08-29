// deep-spec-design-verify-quint sensor — Quint backend for the design IR
// (contract 3, method: bounded | simulation).
//
// COMPILE-DOWN REUSE: each unit is lowered to a contract-1 document
// (transitions -> event obligations; ignores -> explicit no-op events, so
// intended silence never reads as a deadlock) and the PROVEN v1 Quint backend
// runs on it as a child process: reachable invariant violations with step
// traces, deadlocked legal states, leads-to temporal obligations (bounded
// mode), and fully-bound event-free scenarios (the cross-check surface).
// Findings come back remapped into design vocabulary with per-unit
// attribution.
//
// unreachable-state detection (bounded mode only, budget-capped — Q1): per
// machine state not in `initial`, a variant lowering carries the single
// invariant `attr != state` (design invariants dropped — see
// reachabilityVariant); a bounded verify whose violation trace never ends in
// the state means no execution reaches it within the bound. Simulation mode records the family as a
// capability skip — non-observation under random simulation is not evidence.
// Cap: AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP queries per run (default 2); states
// beyond the cap are skipped with the reason, never silently dropped.
//
// Determinism: canonical lowering + the byte-deterministic v1 backend +
// canonical remap sorts. Findings land in
// <dirname(output)>/deep-spec-design-verify/quint.json (contract 2,
// self-validated).

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type Json, isObject, parseFlags, sha256 } from "./deep-spec-lib.ts";
import {
  DESIGN_IR_MAJOR_SUPPORTED,
  DESIGN_MODEL_BASENAME,
  DESIGN_VERIFY_DIRNAME,
  type DFinding,
  type DSkipped,
  type DesignUnit,
  allUnitTargets,
  designIrHashOf,
  extractSingleJsonFence,
  lowerUnit,
  parseDesignIr,
  recomputeDesignCrossCheck,
  remapUnitDoc,
  runSiblingBackend,
  writeDesignDoc,
} from "./deep-spec-design-lib.ts";

const BACKEND = "quint";
const UNIT_WALL_TIMEOUT_MS = 50_000;
const RUN_BUDGET_MS = 50_000;
const UNREACH_BUDGET_MS = 70_000;
const UNREACH_CAP = Number(process.env.AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP) || 2;
const BOUND_STEPS = 8; // mirrors the v1 backend's MAX_STEPS

function enumValuesOf(u: DesignUnit, attrPath: string): string[] {
  if (!Array.isArray(u.rawEntities)) return [];
  for (const ent of u.rawEntities) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
      if (`${ent.name}.${attr.name}` !== attrPath) continue;
      const values = (attr.type as { values?: Json }).values;
      return Array.isArray(values) ? (values.filter((v): v is string => typeof v === "string") as string[]) : [];
    }
  }
  return [];
}

// Variant lowering for reachability of one state: the machine's events, the
// definitional background, and a SINGLE invariant `attr != state`. The design
// invariants are deliberately dropped — v1's init satisfies every invariant,
// so the probe invariant excludes the probed state from init (reaching it
// takes a step), while a design invariant left in invAll would trip first on
// any reachable violation and mask the probe. Exploring without the design
// invariants over-approximates reachability, which is the sound direction:
// "not reached even unconstrained" really means unreachable.
function reachabilityVariant(base: Json, attrPath: string, state: string): Json {
  if (!isObject(base)) return base;
  const obligations = Array.isArray(base.obligations) ? base.obligations : [];
  const events = obligations.filter((ob) => isObject(ob) && ob.nature === "event");
  const probe = {
    id: "OB-9999",
    nature: "invariant",
    frRefs: [] as Json,
    assert: { op: "ne", args: [{ op: "ref", path: attrPath }, { op: "enum", value: state }] } as unknown as Json,
  };
  return {
    irVersion: base.irVersion ?? "1.0.0",
    schema: base.schema ?? { entities: [] },
    obligations: [...events, probe] as unknown as Json,
    scenarios: [] as unknown as Json,
    background: (Array.isArray(base.background) ? base.background : []) as unknown as Json,
  };
}

// The probed state is reached iff the probe run's violation trace actually
// ends in it (a conflict alone is not evidence — belt and braces).
function probeReached(doc: Json, attrPath: string, state: string): boolean {
  if (!isObject(doc) || !Array.isArray(doc.findings)) return false;
  for (const f of doc.findings) {
    if (!isObject(f) || f.kind !== "conflict") continue;
    const witness = isObject(f.witness) ? f.witness : {};
    const trace = Array.isArray(witness.trace) ? witness.trace : null;
    if (trace === null) return true; // violated with no trace detail — assume reached
    const last = trace[trace.length - 1];
    if (isObject(last) && last[attrPath] === state) return true;
  }
  return false;
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-verify-quint: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== DESIGN_MODEL_BASENAME || !existsSync(flags.outputPath)) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  const verifyDir = join(dirname(flags.outputPath), DESIGN_VERIFY_DIRNAME);

  const fence = extractSingleJsonFence(readFileSync(flags.outputPath, "utf-8"));
  let raw: Json = null;
  try {
    raw = fence === null ? null : (JSON.parse(fence) as Json);
  } catch {
    raw = null;
  }
  const parsed = raw === null ? "formal model does not contain exactly one readable ```json fence" : parseDesignIr(raw);
  if (typeof parsed === "string") {
    writeDesignDoc(verifyDir, {
      backend: BACKEND,
      irVersion: "0.0.0",
      irHash: sha256(""),
      method: "simulation",
      unavailable: { reason: `design IR unreadable: ${parsed} — see the deep-spec-design-ir-valid sensor for details` },
      findings: [],
      skipped: [],
    });
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "ir-unreadable" })}\n`);
    process.exit(0);
  }
  const ir = parsed;
  const irHash = designIrHashOf(raw);

  const major = Number.parseInt(ir.irVersion.split(".")[0] ?? "", 10);
  if (major !== DESIGN_IR_MAJOR_SUPPORTED) {
    const skipped: DSkipped[] = ir.units.flatMap((u) =>
      allUnitTargets(u).map((t) => ({
        target: t,
        reason: "ir-version-mismatch",
        unit: u.unit,
        detail: `design IR major version ${major} is not supported by this backend (supports ${DESIGN_IR_MAJOR_SUPPORTED}.x.x)`,
      })),
    );
    writeDesignDoc(verifyDir, { backend: BACKEND, irVersion: ir.irVersion, irHash, method: "simulation", findings: [], skipped });
    recomputeDesignCrossCheck(verifyDir, ir, irHash);
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: skipped.length, note: "ir-version-mismatch" })}\n`);
    process.exit(0);
  }

  const findings: DFinding[] = [];
  const skipped: DSkipped[] = [];
  let method: string | null = null;
  const started = Date.now();

  for (const u of ir.units) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "timeout", unit: u.unit, detail: "the per-run backend budget was exhausted before this unit" });
      }
      continue;
    }
    const lowered = lowerUnit(u, { synthetics: false });
    const run = runSiblingBackend("quint", lowered.v1Doc, UNIT_WALL_TIMEOUT_MS);
    if (run.exit === 127) {
      const reason =
        (isObject(run.doc) && isObject(run.doc.unavailable) && typeof run.doc.unavailable.reason === "string"
          ? run.doc.unavailable.reason
          : null) ?? "quint CLI could not be executed by the lowered v1 backend";
      writeDesignDoc(verifyDir, {
        backend: BACKEND,
        irVersion: ir.irVersion,
        irHash,
        method: method ?? "simulation",
        unavailable: { reason },
        findings: [],
        skipped: ir.units.flatMap((unit) =>
          allUnitTargets(unit).map((t) => ({ target: t, reason: "unavailable", unit: unit.unit, detail: "quint CLI missing" })),
        ),
      });
      recomputeDesignCrossCheck(verifyDir, ir, irHash);
      process.exit(127);
    }
    if (run.doc === null) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "unavailable", unit: u.unit, detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` });
      }
      continue;
    }
    const remapped = remapUnitDoc(u, lowered, run.doc);
    if (remapped.unavailable !== null) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "unavailable", unit: u.unit, detail: remapped.unavailable });
      }
      continue;
    }
    method = method ?? remapped.method;
    findings.push(...remapped.findings);
    skipped.push(...remapped.skipped);

    // Unreachable-state detection (FR8.4): bounded mode only, budget-capped.
    let used = findings.filter((f) => f.kind === "unreachable").length + 0;
    for (const sm of [...u.machines].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const attrPath = lowered.attrPathOfMachine.get(sm.id) ?? `${sm.entity}.${sm.attribute}`;
      const candidates = enumValuesOf(u, attrPath)
        .filter((s) => !sm.initial.includes(s))
        .sort();
      if (candidates.length === 0) continue;
      if (method !== "bounded") {
        skipped.push({
          target: sm.id,
          reason: "capability",
          unit: u.unit,
          detail: `unreachable-state detection for ${sm.id} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${candidates.join(", ")})`,
        });
        continue;
      }
      const leftover: string[] = [];
      for (const state of candidates) {
        if (used >= UNREACH_CAP || Date.now() - started > UNREACH_BUDGET_MS) {
          leftover.push(state);
          continue;
        }
        used += 1;
        const variant = reachabilityVariant(lowered.v1Doc, attrPath, state);
        const probeRun = runSiblingBackend("quint", variant, UNIT_WALL_TIMEOUT_MS);
        if (probeRun.exit !== 0 || probeRun.doc === null || (isObject(probeRun.doc) && isObject(probeRun.doc.unavailable))) {
          leftover.push(state);
          continue;
        }
        const reached = probeReached(probeRun.doc, attrPath, state);
        if (!reached) {
          findings.push({
            kind: "unreachable",
            frRefs: [],
            targets: [sm.id],
            witness: { model: { [attrPath]: state } } as unknown as Json,
            unit: u.unit,
            detail: `State "${state}" of ${sm.id} (${attrPath}) is not reached by any execution within ${BOUND_STEPS} steps from any legal state — it may be dead.`,
          });
        }
      }
      if (leftover.length > 0) {
        skipped.push({
          target: sm.id,
          reason: used >= UNREACH_CAP ? "timeout" : "unavailable",
          unit: u.unit,
          detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id} (per-run cap ${UNREACH_CAP} / budget reached, or the probe run failed)`,
        });
      }
    }
  }

  const finalMethod = method ?? "simulation";
  writeDesignDoc(verifyDir, { backend: BACKEND, irVersion: ir.irVersion, irHash, method: finalMethod, findings, skipped });
  recomputeDesignCrossCheck(verifyDir, ir, irHash);
  process.stdout.write(
    `${JSON.stringify({ pass: findings.length === 0, findings_count: findings.length, skipped_count: skipped.length, method: finalMethod })}\n`,
  );
  process.exit(0);
}

main();
