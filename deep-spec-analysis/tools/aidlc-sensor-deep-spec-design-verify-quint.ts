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
import { findRecordRoot, parseFlags, relArtifact } from "./kernel/adapter/index.ts";
import { isObject, type Json } from "./kernel/adapter/index.ts";
import { sha256 } from "./kernel/domain/index.ts";
import {
  REFINEMENT_MAP_BASENAME,
  REQUIREMENTS_MODEL_RELPATH,
  loadRefinementMap,
  loadRequirementsIr,
  planUnitRefinement,
  refinementQuintExtras,
} from "./deep-spec-refinement-lib.ts";
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
  // Per-unit completion evidence (contract-2 checked[]) — see the SMT tool.
  const checkedUnits: string[] = [];
  let method: string | null = null;
  const started = Date.now();
  // The probe cap is PER RUN, not per unit (AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP).
  let probesUsed = 0;

  for (const u of ir.units) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "timeout", unit: u.unit, detail: "the per-run backend budget was exhausted before this unit" });
      }
      continue;
    }
    const lowered = lowerUnit(u, { synthetics: false });
    // Never let a child outlive the run budget: the dispatcher would kill the
    // sensor mid-write and leave no findings document at all.
    const mainRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (Date.now() - started));
    if (mainRemaining < 3_000) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "timeout", unit: u.unit, detail: "the per-run backend budget was exhausted before this unit" });
      }
      continue;
    }
    const run = runSiblingBackend("quint", lowered.v1Doc, mainRemaining);
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
    checkedUnits.push(`unit:${u.unit}`);

    // Unreachable-state detection (FR8.4): bounded mode only, budget-capped.
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
        const probeRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, UNREACH_BUDGET_MS - (Date.now() - started));
        if (probesUsed >= UNREACH_CAP || probeRemaining < 3_000) {
          leftover.push(state);
          continue;
        }
        probesUsed += 1;
        const variant = reachabilityVariant(lowered.v1Doc, attrPath, state);
        const probeRun = runSiblingBackend("quint", variant, probeRemaining);
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
          reason: probesUsed >= UNREACH_CAP ? "timeout" : "unavailable",
          unit: u.unit,
          detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id} (per-run cap ${UNREACH_CAP} / budget reached, or the probe run failed)`,
        });
      }
    }
  }

  // --- Phase 3 (dynamic): alpha(P) joins the machine's invariant surface ----
  // A violation trace whose violated component is a mapped requirements
  // obligation is a REACHABLE refinement break. Scenario replay, event
  // simulation, and enabledness are SMT-only in v1 (capability skips). The
  // mapping-gap findings are a pure function of the map and both IRs, so both
  // backend documents carry them identically (deduped at question time).
  const recordRoot = findRecordRoot(dirname(flags.outputPath));
  const stageDir = dirname(flags.outputPath);
  const req = recordRoot === null ? null : loadRequirementsIr(recordRoot);
  let inputs: { artifact: string; sha256: string }[] | undefined;
  if (req !== null) {
    const reqTargets = [...req.obligations.map((o) => o.id), ...req.scenarios.map((s) => s.id)];
    const skipAll = (reason: string, detail: string): void => {
      for (const u of ir.units) {
        for (const t of reqTargets) skipped.push({ target: t, reason, unit: u.unit, detail });
      }
    };
    const { map, error: mapError } = loadRefinementMap(stageDir);
    if (map === null) {
      skipAll("absent-input", mapError ?? `no refinement map (${REFINEMENT_MAP_BASENAME}) was authored for this record`);
    } else if (map.requirementsIrHash !== req.hash) {
      skipAll("stale-input", "the refinement map's requirementsIrHash no longer matches the requirements formal model — re-author the map");
    } else if (map.designIrHash !== irHash) {
      skipAll("stale-input", "the refinement map's designIrHash no longer matches this design IR — re-author the map");
    } else {
      const mapPath = join(stageDir, REFINEMENT_MAP_BASENAME);
      const reqModelPath = join(recordRoot as string, ...REQUIREMENTS_MODEL_RELPATH);
      const mapArtifact = relArtifact(recordRoot, mapPath);
      inputs = [
        { artifact: relArtifact(recordRoot, flags.outputPath), sha256: sha256(readFileSync(flags.outputPath, "utf-8")) },
        { artifact: mapArtifact, sha256: sha256(readFileSync(mapPath, "utf-8")) },
        { artifact: relArtifact(recordRoot, reqModelPath), sha256: sha256(readFileSync(reqModelPath, "utf-8")) },
      ];
      for (const u of ir.units) {
        const unitMap = map.units.find((m) => m.unit === u.unit);
        if (!unitMap) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "absent-input", unit: u.unit, detail: `the refinement map has no entry for unit ${u.unit}` });
          }
          continue;
        }
        const plan = planUnitRefinement(u, unitMap, req, mapArtifact);
        findings.push(...plan.gaps);
        for (const [id, st] of [...plan.obligationStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (st.kind === "waived") skipped.push({ target: id, reason: "waived", unit: u.unit, detail: st.reason });
          else if (st.kind === "capability") skipped.push({ target: id, reason: "capability", unit: u.unit, detail: st.detail });
          else if (st.kind === "checkable") {
            const ob = req.obligations.find((o) => o.id === id);
            if (ob?.nature === "event") {
              skipped.push({ target: id, reason: "capability", unit: u.unit, detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" });
            }
          }
        }
        for (const [id, st] of [...plan.scenarioStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (st.kind === "waived") skipped.push({ target: id, reason: "waived", unit: u.unit, detail: st.reason });
          else if (st.kind === "capability") skipped.push({ target: id, reason: "capability", unit: u.unit, detail: st.detail });
          else if (st.kind === "checkable") {
            skipped.push({ target: id, reason: "capability", unit: u.unit, detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" });
          }
        }
        const extras = refinementQuintExtras(plan, req);
        if (extras.length === 0) continue;
        const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS + UNREACH_BUDGET_MS - (Date.now() - started));
        if (remaining < 3_000) {
          for (const e of extras) {
            skipped.push({ target: e.reqId, reason: "timeout", unit: u.unit, detail: "the per-run backend budget was exhausted before the refinement pass" });
          }
          continue;
        }
        const lowered = lowerUnit(u, { synthetics: false });
        const baseObligations = (isObject(lowered.v1Doc) && Array.isArray((lowered.v1Doc as { obligations?: Json }).obligations)
          ? ((lowered.v1Doc as { obligations: Json[] }).obligations as Json[])
          : []);
        let n = baseObligations.length;
        const extraIds = new Map<string, string>();
        for (const e of extras) {
          n += 1;
          const lowId = `OB-${n}`;
          baseObligations.push({ id: lowId, nature: "invariant", frRefs: e.frRefs as unknown as Json, assert: e.expr as unknown as Json });
          lowered.map.set(lowId, { design: e.reqId, kind: "passthrough" });
          extraIds.set(e.reqId, lowId);
        }
        const run = runSiblingBackend("quint", lowered.v1Doc, remaining);
        if (run.exit !== 0 || run.doc === null) {
          for (const e of extras) {
            skipped.push({ target: e.reqId, reason: "unavailable", unit: u.unit, detail: `refinement pass could not run (${run.note.slice(0, 120)})` });
          }
          continue;
        }
        const remapped = remapUnitDoc(u, lowered, run.doc);
        if (remapped.unavailable !== null) {
          for (const e of extras) {
            skipped.push({ target: e.reqId, reason: "unavailable", unit: u.unit, detail: `refinement pass degraded: ${remapped.unavailable}` });
          }
          continue;
        }
        const reqIdSet = new Set(extras.map((e) => e.reqId));
        let hitExtra = false;
        let designConflict = false;
        for (const f of remapped.findings) {
          if (f.kind !== "conflict") continue;
          const reqHits = f.targets.filter((t) => reqIdSet.has(t));
          if (reqHits.length > 0) {
            hitExtra = true;
            findings.push({
              kind: "refinement-violation",
              frRefs: f.frRefs,
              targets: reqHits,
              witness: f.witness,
              unit: u.unit,
              detail: `The design machine of unit ${u.unit} reaches a state that violates requirements obligation ${reqHits.join(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`,
            });
          } else {
            designConflict = true;
          }
        }
        if (!hitExtra && designConflict) {
          for (const e of extras) {
            skipped.push({
              target: e.reqId,
              reason: "capability",
              unit: u.unit,
              detail: "the machine reachably violates its own design invariants first (see the design conflict findings) — refinement reachability is masked until those are resolved",
            });
          }
        }
      }
    }
  }

  const finalMethod = method ?? "simulation";
  const emitted = writeDesignDoc(verifyDir, { backend: BACKEND, irVersion: ir.irVersion, irHash, method: finalMethod, inputs, checked: checkedUnits, findings, skipped });
  recomputeDesignCrossCheck(verifyDir, ir, irHash);
  process.stdout.write(
    `${JSON.stringify({ pass: !emitted.unavailable && emitted.findingsCount === 0, findings_count: emitted.findingsCount, skipped_count: emitted.skippedCount, method: finalMethod })}\n`,
  );
  process.exit(0);
}

main();
