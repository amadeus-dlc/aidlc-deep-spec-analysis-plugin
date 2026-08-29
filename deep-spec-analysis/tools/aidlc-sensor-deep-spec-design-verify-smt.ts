// deep-spec-design-verify-smt sensor — SMT backend for the design IR
// (contract 3, method: exhaustive).
//
// COMPILE-DOWN REUSE: each unit of the design IR is lowered to a contract-1
// document (transitions -> event obligations with the implicit state==from /
// state'=to encoding; ignores -> explicit no-op events) and the PROVEN v1 SMT
// backend is executed on it as a child process. Findings come back remapped
// into design vocabulary (DOB/TR/SM/DSC ids, per-unit attribution).
//
// The two design-only checks ride v1's antecedent-vacuity query through
// synthetic tautological invariants (see deep-spec-design-lib.ts):
//   unreachable — implies(guard, true): an unsatisfiable antecedent IS a dead
//                 rule/transition;
//   redundancy  — implies(and(guardB, not(guardA)), true) with canonically
//                 equal effects: guardB => guardA proven means B is subsumed.
//
// A machine declaring deterministic: false has its same-(state,trigger)
// overlap conflicts converted to skipped[reason: waived] — a human-gated
// model waiver, never silence.
//
// Determinism: the lowering is canonical, the v1 backend is byte-
// deterministic, and the remap sorts canonically; identical design IR +
// identical environment => byte-identical output. Findings land in
// <dirname(output)>/deep-spec-design-verify/smt.json (contract 2,
// self-validated).

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { findRecordRoot, parseFlags, relArtifact } from "./kernel/adapter/index.ts";
import { type Json } from "./kernel/adapter/index.ts";
import { sha256 } from "./kernel/domain/index.ts";
import {
  REFINEMENT_MAP_BASENAME,
  REQUIREMENTS_MODEL_RELPATH,
  loadRefinementMap,
  loadRequirementsIr,
  planUnitRefinement,
  runUnitRefinementSmt,
} from "./deep-spec-refinement-lib.ts";
import {
  DESIGN_IR_MAJOR_SUPPORTED,
  DESIGN_MODEL_BASENAME,
  DESIGN_VERIFY_DIRNAME,
  type DFinding,
  type DSkipped,
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

const BACKEND = "smt";
const UNIT_WALL_TIMEOUT_MS = 55_000;
const RUN_BUDGET_MS = 60_000;

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-verify-smt: --output-path is required\n");
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
      method: "exhaustive",
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
    writeDesignDoc(verifyDir, { backend: BACKEND, irVersion: ir.irVersion, irHash, method: "exhaustive", findings: [], skipped });
    recomputeDesignCrossCheck(verifyDir, ir, irHash);
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: skipped.length, note: "ir-version-mismatch" })}\n`);
    process.exit(0);
  }

  const findings: DFinding[] = [];
  const skipped: DSkipped[] = [];
  // Per-unit completion evidence (contract-2 checked[]): a unit appears iff
  // its design verification actually RAN — the doctor distinguishes a clean
  // unit from one that never ran (PR #7 review follow-up).
  const checkedUnits: string[] = [];
  const started = Date.now();

  for (const u of ir.units) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "timeout", unit: u.unit, detail: "the per-run solver budget was exhausted before this unit" });
      }
      continue;
    }
    const lowered = lowerUnit(u, { synthetics: true });
    // Never let a child outlive the run budget: the dispatcher would kill the
    // sensor mid-write and leave no findings document at all.
    const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (Date.now() - started));
    if (remaining < 3_000) {
      for (const t of allUnitTargets(u)) {
        skipped.push({ target: t, reason: "timeout", unit: u.unit, detail: "the per-run solver budget was exhausted before this unit" });
      }
      continue;
    }
    const run = runSiblingBackend("smt", lowered.v1Doc, remaining);
    if (run.exit === 127) {
      const reason =
        (run.doc && typeof run.doc === "object" && !Array.isArray(run.doc) && typeof (run.doc as { unavailable?: { reason?: string } }).unavailable?.reason === "string"
          ? (run.doc as { unavailable: { reason: string } }).unavailable.reason
          : null) ?? "z3 could not be executed by the lowered v1 backend";
      writeDesignDoc(verifyDir, {
        backend: BACKEND,
        irVersion: ir.irVersion,
        irHash,
        method: "exhaustive",
        unavailable: { reason },
        findings: [],
        skipped: ir.units.flatMap((unit) =>
          allUnitTargets(unit).map((t) => ({ target: t, reason: "unavailable", unit: unit.unit, detail: "z3 could not be executed" })),
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
    findings.push(...remapped.findings);
    skipped.push(...remapped.skipped);
    checkedUnits.push(`unit:${u.unit}`);
  }

  // --- Phase 3: refinement against the verified requirements IR -------------
  // Activated by the presence of the requirements formal model; a map that is
  // missing, stale, or unit-less produces explicit skips, never silence.
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
      // The refinement pass shares the dispatcher's 75s ceiling with the
      // design pass: never start a child that cannot finish inside it.
      const REFINEMENT_DEADLINE_MS = 65_000;
      for (const u of ir.units) {
        const unitMap = map.units.find((m) => m.unit === u.unit);
        if (!unitMap) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "absent-input", unit: u.unit, detail: `the refinement map has no entry for unit ${u.unit}` });
          }
          continue;
        }
        const refRemaining = REFINEMENT_DEADLINE_MS - (Date.now() - started);
        if (refRemaining < 5_000) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "timeout", unit: u.unit, detail: "the per-run solver budget was exhausted before the refinement pass" });
          }
          continue;
        }
        const plan = planUnitRefinement(u, unitMap, req, mapArtifact);
        const res = runUnitRefinementSmt(u, req, plan, mapArtifact, Math.min(30_000, refRemaining));
        if (res.unavailable !== null) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "unavailable", unit: u.unit, detail: res.unavailable });
          }
          continue;
        }
        findings.push(...res.findings);
        skipped.push(...res.skipped);
      }
    }
  }

  const emitted = writeDesignDoc(verifyDir, { backend: BACKEND, irVersion: ir.irVersion, irHash, method: "exhaustive", inputs, checked: checkedUnits, findings, skipped });
  recomputeDesignCrossCheck(verifyDir, ir, irHash);
  process.stdout.write(
    `${JSON.stringify({ pass: !emitted.unavailable && emitted.findingsCount === 0, findings_count: emitted.findingsCount, skipped_count: emitted.skippedCount, method: "exhaustive" })}\n`,
  );
  process.exit(0);
}

main();
