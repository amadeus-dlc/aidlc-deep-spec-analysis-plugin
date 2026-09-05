import { UnitName, SkipReason, VerificationMethod, type FindingsSchema } from "@deep-spec/kernel-domain";

// deep-spec-design-verify-smt の interactor。Repository / Client / Clock を
// 保持し、execute は設計形式モデルのパス（識別）から集約を解決して、
// ユニットごとの lowering → v1 兄弟実行 → remap（Phase 1-2）、続いて
// refinement（Phase 3：map 検査 → alpha 置換クエリ → 判定解釈）→ 組成 →
// finalization までを起動する。
// モデル取得・取得失敗の分類・IR version の適合判定は DesignVerificationAcquirer
// が、適合と両文書の公開は DesignReportFinalizer が一か所で持つ——ここに残るのは
// SMT 固有の solver クエリ・synthetics・予算だけ（BR5.1／BR5.2）。
// 予算・skip の凍結文言はフロー制御の一部としてここが逐語所有する
// （文書系の detail はドメインのファクトリ／解釈が所有——分担は PR5 と同じ）。

import { unreachable } from "@deep-spec/kernel-infrastructure";
import type { Clock } from "@deep-spec/kernel-usecase";
import {
  DesignFindings,
  DesignSkips,
  DesignInputAnchors,
  CheckedUnits,
  type DesignFinding,
  type DesignInputAnchor,
  DesignSkipped,
  DesignReport,
  DesignReportIdentifier,
  RefinementMaterialsIdentifier,
} from "@deep-spec/design-domain";
import {
  UnitRefinementPlan,
} from "@deep-spec/design-domain";

import type { DesignModelRepository } from "./port/design-model-repository.ts";
import type { DesignVerifyDirectoryRepository } from "./port/design-verify-directory-repository.ts";
import { type RefinementMaterialsRepository } from "./port/refinement-materials-repository.ts";
import type { RefinementSolverClient } from "./port/refinement-solver-client.ts";
import type { SiblingBackendClient } from "./port/sibling-backend-client.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";
import type { VerifyDesignInput } from "./verify-design-input.ts";
import { DesignReportFinalizer } from "./design-report-finalizer.ts";
import { DesignVerificationAcquirer } from "./design-verification-acquirer.ts";

const BACKEND = "smt";
const METHOD = "exhaustive";
const UNIT_WALL_TIMEOUT_MS = 55_000;
const RUN_BUDGET_MS = 60_000;
// refinement パスはディスパッチャの 75s 上限を design パスと分け合う：
// その内側で終われない子を決して起動しない。
const REFINEMENT_DEADLINE_MS = 65_000;

// 初期 method は契約2の閉集合の値——strict な門から作る（Workflow 2）。閉集合を
// 外れるのはこのモジュールの定数が壊れたときだけで、予期される失敗ではない。
function initialMethod(): VerificationMethod {
  const parsed = VerificationMethod.parse(METHOD);
  if (!parsed.ok) throw new Error(`defect: "${METHOD}" is not a verification method`);
  return parsed.value;
}

export class VerifyDesignSatisfiabilityModuloTheoriesUseCase {
  readonly #siblingBackendClient: SiblingBackendClient;
  readonly #refinementMaterialsRepository: RefinementMaterialsRepository;
  readonly #refinementSolverClient: RefinementSolverClient;
  readonly #clock: Clock;
  readonly #finalizer: DesignReportFinalizer;
  readonly #acquirer: DesignVerificationAcquirer;

  constructor(
    designModelRepository: DesignModelRepository,
    designVerifyDirectoryRepository: DesignVerifyDirectoryRepository,
    findingsSchema: FindingsSchema,
    siblingBackendClient: SiblingBackendClient,
    refinementMaterialsRepository: RefinementMaterialsRepository,
    refinementSolverClient: RefinementSolverClient,
    clock: Clock,
  ) {
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#refinementSolverClient = refinementSolverClient;
    this.#clock = clock;
    this.#finalizer = new DesignReportFinalizer(designVerifyDirectoryRepository, findingsSchema);
    this.#acquirer = new DesignVerificationAcquirer(designModelRepository, this.#finalizer);
  }

  execute(input: VerifyDesignInput): VerifyDesignOutcome {
    const id = DesignReportIdentifier.of(input.verifyDirectory, BACKEND);
    const acquired = this.#acquirer.acquire(input.modelId, id, initialMethod());
    if (acquired.kind === "terminal") return acquired.outcome;
    // 取得境界の結果は ready と terminal に閉じる——増えた瞬間にここが壊れる。
    if (acquired.kind !== "ready") return unreachable(acquired);
    const model = acquired.model;
    const irHash = acquired.irHash;

    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    // ユニットごとの完了証跡（契約2 checked[]）：設計検証が実際に走った
    // ユニットだけが載る——doctor がクリーンなユニットと未実行を区別する。
    const checkedUnits: string[] = [];
    const started = this.#clock.now();

    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run solver budget was exhausted before this unit" }));
        }
        continue;
      }
      const lowered = u.lowered({ synthetics: true });
      // 子に run budget を超えて生き延びさせない：ディスパッチャがセンサーを
      // 書込途中で殺し、findings 文書が一切残らなくなる。
      const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (remaining < 3_000) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run solver budget was exhausted before this unit" }));
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("smt", u, lowered, remaining);
      if (run.exit === 127) {
        const reason =
          run.doc?.unavailableReason() ?? "z3 could not be executed by the lowered v1 backend";
        const unavailable = DesignReport.backendUnavailable(id, model, irHash, METHOD, reason, "z3 could not be executed");
        const saved = this.#finalizer.finalize(unavailable, model);
        if (!saved.ok) return { kind: "save-failed", error: saved.error };
        return { kind: "backend-unavailable" };
      }
      if (run.doc === null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` }));
        }
        continue;
      }
      const remapped = run.doc.remapVerdicts(u, lowered.index());
      if (remapped.unavailable !== null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: remapped.unavailable }));
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
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    let inputs: readonly DesignInputAnchor[] | undefined;
    if (materials.ok && materials.value.isActive()) {
      const context = materials.value;
      const req = context.requirements();
      const acq = context.mapAcquisition();
      const reqTargets = req.allTargetIds();
      const skipAll = (reason: SkipReason, detail: string): void => {
        for (const u of model.units()) {
          for (const t of reqTargets) skipped.push(DesignSkipped.of({ target: t, reason, unit: UnitName.of(u.name()), detail }));
        }
      };
      acq.match({
        absent: (error) => {
          skipAll(SkipReason.absentInput(), error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
        },
        loaded: (map, mapArtifact, mapInputs) => {
          if (!map.requirementsIrHash().equals(req.hash())) {
            skipAll(SkipReason.staleInput(), "the refinement map's requirementsIrHash no longer matches the requirements formal model — re-author the map");
            return;
          }
          if (!map.designIrHash().equals(irHash)) {
            skipAll(SkipReason.staleInput(), "the refinement map's designIrHash no longer matches this design IR — re-author the map");
            return;
          }
          inputs = mapInputs;
          for (const u of model.units()) {
            const unitMap = map.unitMapOf(u.id());
            if (!unitMap) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.absentInput(), unit: UnitName.of(u.name()), detail: `the refinement map has no entry for unit ${u.name()}` }));
              }
              continue;
            }
            const refRemaining = REFINEMENT_DEADLINE_MS - (this.#clock.now() - started);
            if (refRemaining < 5_000) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run solver budget was exhausted before the refinement pass" }));
              }
              continue;
            }
            const plan = UnitRefinementPlan.of(u, unitMap, req, mapArtifact);
            const check = this.#refinementSolverClient.check(u, req, plan, Math.min(30_000, refRemaining));
            if (check.result.kind === "unavailable") {
              // 旧挙動：unavailable のユニットは gap / status / compile skip を
              // 捨て、全要件対象を一括 unavailable として記録する。
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: check.result.reason }));
              }
              continue;
            }
            findings.push(...plan.gaps());
            skipped.push(...plan.smtStatusSkips(u.name()));
            skipped.push(...check.plan.compileSkips());
            if (check.result.kind === "solved") {
              const interpreted = check.plan.interpret(check.result.verdicts, req, plan, u.name());
              findings.push(...interpreted.findings);
              skipped.push(...interpreted.skipped);
            }
          }
        },
      });
    }

    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: METHOD,
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of(skipped),
      ...(inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {}),
      checked: CheckedUnits.of(Array.from(checkedUnits, (raw) => UnitName.of(raw))),
      ...(!materials.ok ? { unavailableReason: `refinement input could not be acquired: ${materials.error.path} (${materials.error.kind})` } : {}),
    });
    // 適合・両文書の公開・cleanup は Finalizer が一か所で持つ。兄弟が読めない・
    // クロスチェックが書けないときは verified を返さず失敗を運ぶ（BR1.2）。
    const finalized = this.#finalizer.finalize(report, model);
    if (!finalized.ok) return { kind: "save-failed", error: finalized.error };
    if (!materials.ok) return { kind: "acquisition-failed", error: materials.error };
    return finalized.value;
  }
}
