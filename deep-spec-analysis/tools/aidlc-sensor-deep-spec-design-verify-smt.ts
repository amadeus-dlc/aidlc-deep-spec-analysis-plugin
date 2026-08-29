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
// synthetic tautological invariants (see design/domain/lower-unit.ts):
//   unreachable — implies(guard, true): an unsatisfiable antecedent IS a dead
//                 rule/transition;
//   redundancy  — implies(and(guardB, not(guardA)), true) with canonically
//                 equal effects: guardB => guardA proven means B is subsumed.
//
// 編成ルート：設計 lowering・remap・文書組成は design/{domain,adapter} が
// 所有し、この entry は取得 → ユニットごとの lowering → 兄弟実行 → remap →
// 組成 → 永続化 → クロスチェック再計算を編成する。Phase 3（refinement）は
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
  runUnitRefinementSmt,
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

const BACKEND = "smt";
const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
const DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";
const UNIT_WALL_TIMEOUT_MS = 55_000;
const RUN_BUDGET_MS = 60_000;

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-verify-smt: --output-path is required\n");
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
      process.stderr.write(`deep-spec-design-verify-smt: ${saved.error.path}: ${saved.error.kind}${"cause" in saved.error ? ` (${saved.error.cause})` : ""}\n`);
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
      process.stderr.write(`deep-spec-design-verify-smt: ${acquired.error.path}: ${acquired.error.kind} (${acquired.error.cause})\n`);
      process.exit(1);
    }
    persist(designIrUnreadableReport(id, "exhaustive", acquired.error.cause));
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
    // 旧実装は conform 前の skip 数を verdict 行に載せていた（自己検証降格が
    // 起きても stdout は元の件数のまま）——凍結挙動として組成時の件数を使う。
    const mismatch = designVersionMismatchReport(id, model, irHash, "exhaustive");
    persist(mismatch);
    recomputeCrossCheck();
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: mismatch.skippedCount(), note: "ir-version-mismatch" })}\n`);
    process.exit(0);
  }

  const findings: DesignFinding[] = [];
  const skipped: DesignSkipped[] = [];
  // ユニットごとの完了証跡（契約2 checked[]）：設計検証が実際に走ったユニット
  // だけが載る——doctor がクリーンなユニットと未実行を区別する（PR #7 追補）。
  const checkedUnits: string[] = [];
  const started = Date.now();

  for (const u of model.units()) {
    if (Date.now() - started > RUN_BUDGET_MS) {
      for (const t of u.allTargets()) {
        skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before this unit" });
      }
      continue;
    }
    const lowered = lowerUnit(u, { synthetics: true });
    // 子に run budget を超えて生き延びさせない：ディスパッチャがセンサーを
    // 書込途中で殺し、findings 文書が一切残らなくなる。
    const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (Date.now() - started));
    if (remaining < 3_000) {
      for (const t of u.allTargets()) {
        skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before this unit" });
      }
      continue;
    }
    const run = sibling.runLowered("smt", u, lowered, remaining);
    if (run.exit === 127) {
      const reason =
        (run.doc?.kind === "unavailable" ? run.doc.reason : null) ?? "z3 could not be executed by the lowered v1 backend";
      persist(designBackendUnavailableReport(id, model, irHash, "exhaustive", reason, "z3 could not be executed"));
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
    findings.push(...remapped.findings);
    skipped.push(...remapped.skipped);
    checkedUnits.push(`unit:${u.name()}`);
  }

  // --- Phase 3: refinement against the verified requirements IR -------------
  // 要件形式モデルの存在で発火。欠落・陳腐化・ユニット欠けの map は明示 skip
  // を生む——沈黙しない。（refinement-lib は PR6 で解体予定の legacy——entry
  // からのみ呼ぶ逐語温存。）
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
      // refinement パスはディスパッチャの 75s 上限を design パスと分け合う：
      // その内側で終われない子を決して起動しない。
      const REFINEMENT_DEADLINE_MS = 65_000;
      for (const u of model.units()) {
        const unitMap = map.units.find((m) => m.unit === u.name());
        if (!unitMap) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "absent-input", unit: u.name(), detail: `the refinement map has no entry for unit ${u.name()}` });
          }
          continue;
        }
        const refRemaining = REFINEMENT_DEADLINE_MS - (Date.now() - started);
        if (refRemaining < 5_000) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before the refinement pass" });
          }
          continue;
        }
        const plan = planUnitRefinement(u, unitMap, req, mapArtifact);
        const res = runUnitRefinementSmt(u, req, plan, mapArtifact, Math.min(30_000, refRemaining));
        if (res.unavailable !== null) {
          for (const t of reqTargets) {
            skipped.push({ target: t, reason: "unavailable", unit: u.name(), detail: res.unavailable });
          }
          continue;
        }
        findings.push(...res.findings);
        skipped.push(...res.skipped);
      }
    }
  }

  const written = persist(
    DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings,
      skipped,
      ...(inputs !== undefined ? { inputs } : {}),
      checked: checkedUnits,
    }),
  );
  recomputeCrossCheck();
  process.stdout.write(
    `${JSON.stringify({ pass: written.passes(), findings_count: written.findingsCount(), skipped_count: written.skippedCount(), method: "exhaustive" })}\n`,
  );
  process.exit(0);
}

main();
