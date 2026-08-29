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
// design/adapter/reachability-variant.ts); a bounded verify whose violation
// trace never ends in the state means no execution reaches it within the
// bound. Simulation mode records the family as a capability skip. Cap:
// AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP queries per run (default 2); states
// beyond the cap are skipped with the reason, never silently dropped.
//
// 編成ルート：設計 lowering・remap・文書組成は design/{domain,adapter} が
// 所有し、この entry は編成のみ。Phase 3（refinement・動的パス）は
// refinement-lib（PR6 で解体予定の legacy）を entry からのみ呼ぶ逐語温存。
// verdict は conformed（＝書かれた姿）から導出する。

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRecordRoot, parseFlags, relArtifact } from "./kernel/adapter/index.ts";
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
  type DesignFinding,
  type DesignInputEntry,
  type DesignSkipped,
  DesignReport,
  DesignReportId,
  SUPPORTED_DESIGN_IR_MAJOR,
  designBackendUnavailableReport,
  designCrossCheckReport,
  designIrUnreadableReport,
  designVersionMismatchReport,
  lowerUnit,
  remapUnitDoc,
} from "./design/domain/index.ts";
import {
  DesignModelRepositoryImpl,
  DesignReportRepositoryImpl,
  SiblingBackendClientImpl,
} from "./design/adapter/index.ts";

const BACKEND = "quint";
const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
const DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";
const UNIT_WALL_TIMEOUT_MS = 50_000;
const RUN_BUDGET_MS = 50_000;
const UNREACH_BUDGET_MS = 70_000;
const UNREACH_CAP = Number(process.env.AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP) || 2;
const BOUND_STEPS = 8; // mirrors the v1 backend's MAX_STEPS

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-verify-quint: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== DESIGN_MODEL_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  const verifyDir = join(dirname(flags.outputPath), DESIGN_VERIFY_DIRNAME);
  const toolsDir = dirname(fileURLToPath(import.meta.url));
  const reports = new DesignReportRepositoryImpl(join(toolsDir, "data", "deep-spec-findings-schema.json"));
  const sibling = new SiblingBackendClientImpl({ toolsDirectory: toolsDir, workingDirectory: process.cwd() });
  const id = DesignReportId.of(verifyDir, BACKEND);
  const persist = (report: DesignReport): DesignReport => {
    const conformed = reports.conformedOf(report);
    const saved = reports.save(conformed);
    if (!saved.ok) {
      process.stderr.write(`deep-spec-design-verify-quint: ${saved.error.path}: ${saved.error.kind}${"cause" in saved.error ? ` (${saved.error.cause})` : ""}\n`);
      process.exit(1);
    }
    return conformed;
  };

  const acquired = new DesignModelRepositoryImpl().findByPath(flags.outputPath);
  if (!acquired.ok) {
    if (acquired.error.kind === "not-found") {
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
      process.exit(0);
    }
    if (acquired.error.kind === "io-failed") {
      process.stderr.write(`deep-spec-design-verify-quint: ${acquired.error.path}: ${acquired.error.kind} (${acquired.error.cause})\n`);
      process.exit(1);
    }
    persist(designIrUnreadableReport(id, "simulation", acquired.error.cause));
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "ir-unreadable" })}\n`);
    process.exit(0);
  }
  const { model, irHash } = acquired.value;
  const recomputeCrossCheck = (): void => {
    const siblings = reports.findAllByDirectory(verifyDir);
    // 旧挙動: ディレクトリが読めないときは黙って諦める（自文書は書けている）。
    if (!siblings.ok) return;
    persist(designCrossCheckReport(DesignReportId.of(verifyDir, "cross-check"), model, irHash, siblings.value));
  };

  if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
    const written = persist(designVersionMismatchReport(id, model, irHash, "simulation"));
    recomputeCrossCheck();
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: written.skippedCount(), note: "ir-version-mismatch" })}\n`);
    process.exit(0);
  }

  const findings: DesignFinding[] = [];
  const skipped: DesignSkipped[] = [];
  // ユニットごとの完了証跡（契約2 checked[]）——SMT tool と同じ。
  const checkedUnits: string[] = [];
  let method: string | null = null;
  const started = Date.now();
  // プローブ上限はユニットごとでなく RUN ごと（AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP）。
  let probesUsed = 0;

  for (const u of model.units()) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      for (const t of u.allTargets()) {
        skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before this unit" });
      }
      continue;
    }
    const lowered = lowerUnit(u, { synthetics: false });
    // 子に run budget を超えて生き延びさせない：ディスパッチャがセンサーを
    // 書込途中で殺し、findings 文書が一切残らなくなる。
    const mainRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (Date.now() - started));
    if (mainRemaining < 3_000) {
      for (const t of u.allTargets()) {
        skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before this unit" });
      }
      continue;
    }
    const run = sibling.runLowered("quint", u, lowered, mainRemaining);
    if (run.exit === 127) {
      const reason =
        (run.doc?.kind === "unavailable" ? run.doc.reason : null) ?? "quint CLI could not be executed by the lowered v1 backend";
      persist(designBackendUnavailableReport(id, model, irHash, method ?? "simulation", reason, "quint CLI missing"));
      recomputeCrossCheck();
      // 127 = tool-unavailable to the dispatcher; the findings file already
      // records the degradation for the stage.
      process.exit(127);
    }
    if (run.doc === null) {
      for (const t of u.allTargets()) {
        skipped.push({ target: t, reason: "unavailable", unit: u.name(), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` });
      }
      continue;
    }
    const remapped = remapUnitDoc(u, lowered, run.doc ?? { kind: "unreadable" });
    if (remapped.unavailable !== null) {
      for (const t of u.allTargets()) {
        skipped.push({ target: t, reason: "unavailable", unit: u.name(), detail: remapped.unavailable });
      }
      continue;
    }
    method = method ?? remapped.method;
    findings.push(...remapped.findings);
    skipped.push(...remapped.skipped);
    checkedUnits.push(`unit:${u.name()}`);

    // Unreachable-state detection (FR8.4): bounded mode only, budget-capped.
    for (const sm of [...u.machines()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const attrPath = lowered.attrPathOfMachine.get(sm.id) ?? `${sm.entity}.${sm.attribute}`;
      const candidates = u
        .enumValuesOf(attrPath)
        .filter((s) => !sm.initial.includes(s))
        .sort();
      if (candidates.length === 0) continue;
      if (method !== "bounded") {
        skipped.push({
          target: sm.id,
          reason: "capability",
          unit: u.name(),
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
        const probe = sibling.probeState(u, lowered, attrPath, state, probeRemaining);
        if (probe.kind === "failed") {
          leftover.push(state);
          continue;
        }
        if (!probe.reached) {
          findings.push({
            kind: "unreachable",
            frRefs: [],
            targets: [sm.id],
            witness: { model: { [attrPath]: state } },
            unit: u.name(),
            detail: `State "${state}" of ${sm.id} (${attrPath}) is not reached by any execution within ${BOUND_STEPS} steps from any legal state — it may be dead.`,
          });
        }
      }
      if (leftover.length > 0) {
        skipped.push({
          target: sm.id,
          reason: probesUsed >= UNREACH_CAP ? "timeout" : "unavailable",
          unit: u.name(),
          detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id} (per-run cap ${UNREACH_CAP} / budget reached, or the probe run failed)`,
        });
      }
    }
  }

  // --- Phase 3 (dynamic): alpha(P) joins the machine's invariant surface ----
  // 違反トレースの違反成分が写像済み要件義務なら、それは到達可能な refinement
  // 破れ。シナリオ再生・イベントシミュレーション・enabledness は v1 では
  // SMT 専用（capability skip）。mapping-gap は map と両 IR の純関数なので
  // 両バックエンド文書が同一に運ぶ（質問時に重複排除）。
  const recordRoot = findRecordRoot(dirname(flags.outputPath));
  const stageDir = dirname(flags.outputPath);
  const req = recordRoot === null ? null : loadRequirementsIr(recordRoot);
  let inputs: DesignInputEntry[] | undefined;
  if (req !== null) {
    const reqTargets = [...req.obligations.map((o) => o.id), ...req.scenarios.map((s) => s.id)];
    const skipAll = (reason: string, detail: string): void => {
      for (const u of model.units()) {
        for (const t of reqTargets) skipped.push({ target: t, reason, unit: u.name(), detail });
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
      for (const u of model.units()) {
        const unitMap = map.units.find((m) => m.unit === u.name());
        if (!unitMap) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "absent-input", unit: u.name(), detail: `the refinement map has no entry for unit ${u.name()}` });
          }
          continue;
        }
        const plan = planUnitRefinement(u, unitMap, req, mapArtifact);
        findings.push(...plan.gaps);
        for (const [rid, st] of [...plan.obligationStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (st.kind === "waived") skipped.push({ target: rid, reason: "waived", unit: u.name(), detail: st.reason });
          else if (st.kind === "capability") skipped.push({ target: rid, reason: "capability", unit: u.name(), detail: st.detail });
          else if (st.kind === "checkable") {
            const ob = req.obligations.find((o) => o.id === rid);
            if (ob?.nature === "event") {
              skipped.push({ target: rid, reason: "capability", unit: u.name(), detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" });
            }
          }
        }
        for (const [rid, st] of [...plan.scenarioStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (st.kind === "waived") skipped.push({ target: rid, reason: "waived", unit: u.name(), detail: st.reason });
          else if (st.kind === "capability") skipped.push({ target: rid, reason: "capability", unit: u.name(), detail: st.detail });
          else if (st.kind === "checkable") {
            skipped.push({ target: rid, reason: "capability", unit: u.name(), detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" });
          }
        }
        const extras = refinementQuintExtras(plan, req);
        if (extras.length === 0) continue;
        const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS + UNREACH_BUDGET_MS - (Date.now() - started));
        if (remaining < 3_000) {
          for (const e of extras) {
            skipped.push({ target: e.reqId, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before the refinement pass" });
          }
          continue;
        }
        const lowered = lowerUnit(u, { synthetics: false });
        let n = lowered.obligations.length;
        const extraIds = new Map<string, string>();
        for (const e of extras) {
          n += 1;
          const lowId = `OB-${n}`;
          lowered.obligations.push({ id: lowId, nature: "invariant", frRefs: e.frRefs, assert: e.expr });
          lowered.map.set(lowId, { design: e.reqId, kind: "passthrough" });
          extraIds.set(e.reqId, lowId);
        }
        const run = sibling.runLowered("quint", u, lowered, remaining);
        if (run.exit !== 0 || run.doc === null) {
          for (const e of extras) {
            skipped.push({ target: e.reqId, reason: "unavailable", unit: u.name(), detail: `refinement pass could not run (${run.note.slice(0, 120)})` });
          }
          continue;
        }
        const remapped = remapUnitDoc(u, lowered, run.doc);
        if (remapped.unavailable !== null) {
          for (const e of extras) {
            skipped.push({ target: e.reqId, reason: "unavailable", unit: u.name(), detail: `refinement pass degraded: ${remapped.unavailable}` });
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
              unit: u.name(),
              detail: `The design machine of unit ${u.name()} reaches a state that violates requirements obligation ${reqHits.join(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`,
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
              unit: u.name(),
              detail: "the machine reachably violates its own design invariants first (see the design conflict findings) — refinement reachability is masked until those are resolved",
            });
          }
        }
      }
    }
  }

  const finalMethod = method ?? "simulation";
  const written = persist(
    DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: finalMethod,
      findings,
      skipped,
      ...(inputs !== undefined ? { inputs } : {}),
      checked: checkedUnits,
    }),
  );
  recomputeCrossCheck();
  process.stdout.write(
    `${JSON.stringify({ pass: written.passes(), findings_count: written.findingsCount(), skipped_count: written.skippedCount(), method: finalMethod })}\n`,
  );
  process.exit(0);
}

main();
