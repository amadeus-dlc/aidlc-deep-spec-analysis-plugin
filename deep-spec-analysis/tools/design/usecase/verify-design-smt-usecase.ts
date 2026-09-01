// deep-spec-design-verify-smt の interactor。Repository / Client / Clock を
// 保持し、execute は設計形式モデルのパス（識別）から集約を解決して、
// ユニットごとの lowering → v1 兄弟実行 → remap（Phase 1-2）、続いて
// refinement（Phase 3：map 検査 → alpha 置換クエリ → 判定解釈）→ 組成 →
// 契約適合 → 永続化 → クロスチェック再計算までを起動する。
// 予算・skip の凍結文言はフロー制御の一部としてここが逐語所有する
// （文書系の detail はドメインのファクトリ／解釈が所有——分担は PR5 と同じ）。

import type { ArtifactPath, ContentHash } from "../../kernel/domain/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { ok } from "../../kernel/infrastructure/index.ts";
import type { Clock, RepositoryError } from "../../kernel/usecase/index.ts";
import {
  DesignFindings,
  DesignSkips,
  DesignInputAnchors,
  CheckedUnits,
  type DesignFinding,
  type DesignInputAnchor,
  type DesignSkipped,
  DesignReport,
  DesignReportId,
  type DesignModel,
  SUPPORTED_DESIGN_IR_MAJOR,
  LoweredUnit,
  RefinementMaterialsId,
} from "../domain/index.ts";
import {
  UnitRefinementPlan,
} from "../../refinement/domain/index.ts";
import type { DesignModelRepository } from "./port/design-model-repository.ts";
import type { DesignReportRepository } from "./port/design-report-repository.ts";
import { type RefinementMaterialsRepository } from "./port/refinement-materials-repository.ts";
import type { RefinementSolverClient } from "./port/refinement-solver-client.ts";
import type { SiblingBackendClient } from "./port/sibling-backend-client.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";
import type { VerifyDesignInput } from "./verify-design-input.ts";

const BACKEND = "smt";
const CROSS_CHECK_BACKEND = "cross-check";
const UNIT_WALL_TIMEOUT_MS = 55_000;
const RUN_BUDGET_MS = 60_000;
// refinement パスはディスパッチャの 75s 上限を design パスと分け合う：
// その内側で終われない子を決して起動しない。
const REFINEMENT_DEADLINE_MS = 65_000;


export class VerifyDesignSmtUseCase {
  readonly #designModelRepository: DesignModelRepository;
  readonly #designReportRepository: DesignReportRepository;
  readonly #siblingBackendClient: SiblingBackendClient;
  readonly #refinementMaterialsRepository: RefinementMaterialsRepository;
  readonly #refinementSolverClient: RefinementSolverClient;
  readonly #clock: Clock;

  constructor(
    designModelRepository: DesignModelRepository,
    designReportRepository: DesignReportRepository,
    siblingBackendClient: SiblingBackendClient,
    refinementMaterialsRepository: RefinementMaterialsRepository,
    refinementSolverClient: RefinementSolverClient,
    clock: Clock,
  ) {
    this.#designModelRepository = designModelRepository;
    this.#designReportRepository = designReportRepository;
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#refinementSolverClient = refinementSolverClient;
    this.#clock = clock;
  }

  execute(input: VerifyDesignInput): VerifyDesignOutcome {
    const id = DesignReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#designModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(DesignReport.irUnreadable(id, "exhaustive", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();

    if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
      // 旧実装は conform 前の skip 数を verdict 行に載せていた——凍結挙動。
      const mismatch = DesignReport.versionMismatch(id, model, irHash, "exhaustive");
      const saved = this.#persist(mismatch);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "version-mismatch", skippedCount: mismatch.skippedCount() };
    }

    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    // ユニットごとの完了証跡（契約2 checked[]）：設計検証が実際に走った
    // ユニットだけが載る——doctor がクリーンなユニットと未実行を区別する。
    const checkedUnits: string[] = [];
    const started = this.#clock.now();

    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        for (const t of u.allTargets()) {
          skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before this unit" });
        }
        continue;
      }
      const lowered = LoweredUnit.of(u, { synthetics: true });
      // 子に run budget を超えて生き延びさせない：ディスパッチャがセンサーを
      // 書込途中で殺し、findings 文書が一切残らなくなる。
      const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (remaining < 3_000) {
        for (const t of u.allTargets()) {
          skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before this unit" });
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("smt", u, lowered, remaining);
      if (run.exit === 127) {
        const reason =
          (run.doc?.kind === "unavailable" ? run.doc.reason : null) ?? "z3 could not be executed by the lowered v1 backend";
        const saved = this.#persist(DesignReport.backendUnavailable(id, model, irHash, "exhaustive", reason, "z3 could not be executed"));
        if (!saved.ok) return { kind: "save-failed", error: saved.error };
        const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
        if (!cross.ok) return { kind: "save-failed", error: cross.error };
        return { kind: "backend-unavailable" };
      }
      if (run.doc === null) {
        for (const t of u.allTargets()) {
          skipped.push({ target: t, reason: "unavailable", unit: u.name(), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` });
        }
        continue;
      }
      const remapped = lowered.remapVerdicts(u, run.doc);
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

    // --- Phase 3: 検証済み要件 IR に対する refinement ------------------------
    // 要件形式モデルの存在で発火。欠落・陳腐化・ユニット欠けの map は明示 skip
    // を生む——沈黙しない。
    const context = this.#refinementMaterialsRepository.findById(RefinementMaterialsId.ofModel(input.modelId));
    let inputs: readonly DesignInputAnchor[] | undefined;
    if (context.isActive()) {
      const req = context.requirements();
      const acq = context.mapAcquisition();
      const reqTargets = req.allTargetIds();
      const skipAll = (reason: string, detail: string): void => {
        for (const u of model.units()) {
          for (const t of reqTargets) skipped.push({ target: t, reason, unit: u.name(), detail });
        }
      };
      if (acq.kind === "absent") {
        skipAll("absent-input", acq.error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
      } else if (!acq.map.requirementsIrHash().equals(req.hash())) {
        skipAll("stale-input", "the refinement map's requirementsIrHash no longer matches the requirements formal model — re-author the map");
      } else if (!acq.map.designIrHash().equals(irHash)) {
        skipAll("stale-input", "the refinement map's designIrHash no longer matches this design IR — re-author the map");
      } else {
        inputs = acq.inputs;
        for (const u of model.units()) {
          const unitMap = acq.map.unitMapOf(u.id());
          if (!unitMap) {
            for (const t of reqTargets) {
              skipped.push({ target: t, reason: "absent-input", unit: u.name(), detail: `the refinement map has no entry for unit ${u.name()}` });
            }
            continue;
          }
          const refRemaining = REFINEMENT_DEADLINE_MS - (this.#clock.now() - started);
          if (refRemaining < 5_000) {
            for (const t of reqTargets) {
              skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before the refinement pass" });
            }
            continue;
          }
          const plan = UnitRefinementPlan.of(u, unitMap, req, acq.mapArtifact);
          const check = this.#refinementSolverClient.check(u, req, plan, Math.min(30_000, refRemaining));
          if (check.result.kind === "unavailable") {
            // 旧挙動：unavailable のユニットは gap / status / compile skip を
            // 捨て、全要件対象を一括 unavailable として記録する。
            for (const t of reqTargets) {
              skipped.push({ target: t, reason: "unavailable", unit: u.name(), detail: check.result.reason });
            }
            continue;
          }
          findings.push(...plan.gaps());
          skipped.push(...plan.smtStatusSkips(u.name()));
          skipped.push(...check.facts.compileSkips());
          if (check.result.kind === "solved") {
            const interpreted = check.facts.interpret(check.result.verdicts, req, plan, u.name());
            findings.push(...interpreted.findings);
            skipped.push(...interpreted.skipped);
          }
        }
      }
    }

    const stored = this.#designReportRepository.store(
      DesignReport.compose({
        id,
        irVersion: model.irVersion(),
        irHash,
        method: "exhaustive",
        findings: DesignFindings.of(findings),
        skipped: DesignSkips.of(skipped),
        ...(inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {}),
        checked: CheckedUnits.of(checkedUnits),
      }),
    );
    if (!stored.ok) return { kind: "save-failed", error: stored.error };
    const conformed = stored.value;
    const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
    if (!cross.ok) return { kind: "save-failed", error: cross.error };
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
      method: "exhaustive",
    };
  }

  #persist(report: DesignReport): Result<DesignReport, RepositoryError> {
    return this.#designReportRepository.store(report);
  }

  // 自文書を書いた後に、同一ディレクトリの全バックエンド文書からクロス
  // チェックを再計算する（最後の書き手が勝ち、全書き手が同一バイトへ収束）。
  #recomputeCrossCheck(model: DesignModel, irHash: ContentHash, directory: ArtifactPath): Result<void, RepositoryError> {
    const siblings = this.#designReportRepository.findAllByDirectory(directory);
    // 旧挙動: ディレクトリが読めないときは黙って諦める（自文書は書けている）。
    if (!siblings.ok) return ok(undefined);
    const stored = this.#persist(siblings.value.crossChecked(DesignReportId.of(directory, CROSS_CHECK_BACKEND), model, irHash));
    return stored.ok ? ok(undefined) : stored;

  }
}
