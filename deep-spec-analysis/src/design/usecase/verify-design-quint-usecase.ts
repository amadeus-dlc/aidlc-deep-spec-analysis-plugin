import {
  TargetId,
  UnitName,
  FindingKind,
  FrRefs,
  SkipReason,
  TargetIds,
  VerificationMethod,
  type FindingsSchema,
} from "@deep-spec/kernel-domain";

// deep-spec-design-verify-quint の interactor。Phase 1-2（lowering → v1 quint
// 兄弟 → remap）＋到達性プローブ（bounded のみ・RUN ごとの上限つき）＋
// Phase 3（refinement の動的パス：alpha(P) が機械の不変量面に合流し、違反
// トレースは到達可能な refinement 破れ。シナリオ再生・イベントシミュレーション・
// enabledness は v1 では SMT 専用の capability skip）を編成する。
// mapping-gap は map と両 IR の純関数なので両バックエンド文書が同一に運ぶ。
// モデル取得・取得失敗の分類・IR version の適合判定は DesignVerificationAcquirer
// が、適合と両文書の公開は DesignReportFinalizer が一か所で持つ——ここに残るのは
// Quint 固有の method 更新・到達性プローブ・上限・refinement extras（BR5.1／BR5.2）。

import { unreachable } from "@deep-spec/kernel-infrastructure";
import type { Clock } from "@deep-spec/kernel-usecase";
import { DesignWitness,
  DesignMachines,
  DesignFindings,
  DesignSkips,
  DesignInputAnchors,
  CheckedUnits,
  DesignFinding,
  type DesignInputAnchor,
  DesignSkipped,
  DesignReport,
  DesignReportId,
  RefinementMaterialsId,
  LoweredId,
} from "@deep-spec/design-domain";
import {
  UnitRefinementPlan,
} from "@deep-spec/design-domain";

import type { DesignModelRepository } from "./port/design-model-repository.ts";
import type { DesignVerifyDirectoryRepository } from "./port/design-verify-directory-repository.ts";
import { type RefinementMaterialsRepository } from "./port/refinement-materials-repository.ts";
import type { SiblingBackendClient } from "./port/sibling-backend-client.ts";
import { type VerifyDesignInput } from "./verify-design-input.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";
import { DesignReportFinalizer } from "./design-report-finalizer.ts";
import { DesignVerificationAcquirer } from "./design-verification-acquirer.ts";

const BACKEND = "quint";
const INITIAL_METHOD_NAME = "simulation";
const UNIT_WALL_TIMEOUT_MS = 50_000;
const RUN_BUDGET_MS = 50_000;
const UNREACH_BUDGET_MS = 70_000;
const BOUND_STEPS = 8; // v1 バックエンドの MAX_STEPS を写す

// 初期 method は契約2の閉集合の値——strict な門から作る（Workflow 2）。閉集合を
// 外れるのはこのモジュールの定数が壊れたときだけで、予期される失敗ではない。
function initialMethod(): VerificationMethod {
  const parsed = VerificationMethod.parse(INITIAL_METHOD_NAME);
  if (!parsed.ok) throw new Error(`defect: "${INITIAL_METHOD_NAME}" is not a verification method`);
  return parsed.value;
}

export class VerifyDesignQuintUseCase {
  readonly #siblingBackendClient: SiblingBackendClient;
  readonly #refinementMaterialsRepository: RefinementMaterialsRepository;
  readonly #clock: Clock;
  readonly #unreachCap: number;
  readonly #finalizer: DesignReportFinalizer;
  readonly #acquirer: DesignVerificationAcquirer;

  constructor(
    designModelRepository: DesignModelRepository,
    designVerifyDirectoryRepository: DesignVerifyDirectoryRepository,
    findingsSchema: FindingsSchema,
    siblingBackendClient: SiblingBackendClient,
    refinementMaterialsRepository: RefinementMaterialsRepository,
    clock: Clock,
    unreachCap: number,
  ) {
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#clock = clock;
    this.#unreachCap = unreachCap;
    this.#finalizer = new DesignReportFinalizer(designVerifyDirectoryRepository, findingsSchema);
    this.#acquirer = new DesignVerificationAcquirer(designModelRepository, this.#finalizer);
  }

  execute(input: VerifyDesignInput): VerifyDesignOutcome {
    const id = DesignReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#acquirer.acquire(input.modelId, id, initialMethod());
    if (acquired.kind === "terminal") return acquired.outcome;
    // 取得境界の結果は ready と terminal に閉じる——増えた瞬間にここが壊れる。
    if (acquired.kind !== "ready") return unreachable(acquired);
    const model = acquired.model;
    const irHash = acquired.irHash;

    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    // ユニットごとの完了証跡（契約2 checked[]）——SMT ユースケースと同じ。
    const checkedUnits: string[] = [];
    let method: string | null = null;
    const started = this.#clock.now();
    // プローブ上限はユニットごとでなく RUN ごと（AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP）。
    let probesUsed = 0;

    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run backend budget was exhausted before this unit" }));
        }
        continue;
      }
      const lowered = u.lowered({ synthetics: false });
      // 子に run budget を超えて生き延びさせない。
      const mainRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (mainRemaining < 3_000) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run backend budget was exhausted before this unit" }));
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("quint", u, lowered, mainRemaining);
      if (run.exit === 127) {
        const reason =
          run.doc?.unavailableReason() ?? "quint CLI could not be executed by the lowered v1 backend";
        const unavailable = DesignReport.backendUnavailable(id, model, irHash, method ?? INITIAL_METHOD_NAME, reason, "quint CLI missing");
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
      method = method ?? remapped.method;
      findings.push(...remapped.findings);
      skipped.push(...remapped.skipped);
      checkedUnits.push(`unit:${u.name()}`);

      // 到達不能状態の検出（FR8.4）：bounded モードのみ・予算キャップつき。
      for (const sm of u.machines().sortedById()) {
        const attrPath = lowered.index().attrPathOfMachine(sm.id().asString()) ?? DesignMachines.attrPathOf(sm);
        // 候補の選別（初期状態でない宣言値・昇順）は機械自身へ命じる（波7）。
        const candidates = sm.nonInitialCandidates(u.enumValuesOf(attrPath));
        if (candidates.length === 0) continue;
        if (method !== "bounded") {
          skipped.push(DesignSkipped.of({
            target: sm.id().asTargetId(),
            reason: SkipReason.capability(),
            unit: UnitName.of(u.name()),
            detail: `unreachable-state detection for ${sm.id().asString()} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${candidates.join(", ")})`,
          }));
          continue;
        }
        const leftover: string[] = [];
        for (const state of candidates) {
          const probeRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, UNREACH_BUDGET_MS - (this.#clock.now() - started));
          if (probesUsed >= this.#unreachCap || probeRemaining < 3_000) {
            leftover.push(state);
            continue;
          }
          probesUsed += 1;
          const probe = this.#siblingBackendClient.probeState(u, lowered, attrPath, state, probeRemaining);
          probe.match({
            reached: () => {},
            unverified: () => { leftover.push(state); },
            notReachedWithinBound: () => {
              findings.push(DesignFinding.of({
                kind: FindingKind.unreachable(),
                frRefs: FrRefs.of([]),
                targets: TargetIds.of(Array.from([sm.id().asString()], (raw) => TargetId.of(raw))),
                witness: DesignWitness.model({ [attrPath]: state }),
                unit: UnitName.of(u.name()),
                detail: `State "${state}" of ${sm.id().asString()} (${attrPath}) is not reached by any execution within ${BOUND_STEPS} steps from any legal state — it may be dead.`,
              }));
            },
          });
        }
        if (leftover.length > 0) {
          skipped.push(DesignSkipped.of({
            target: sm.id().asTargetId(),
            reason: probesUsed >= this.#unreachCap ? SkipReason.timeout() : SkipReason.unavailable(),
            unit: UnitName.of(u.name()),
            detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id().asString()} (per-run cap ${this.#unreachCap} / budget reached, or the probe run failed)`,
          }));
        }
      }
    }

    // --- Phase 3（動的）：alpha(P) が機械の不変量面に合流する -----------------
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsId.ofModel(input.modelId));
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
            const plan = UnitRefinementPlan.of(u, unitMap, req, mapArtifact);
            findings.push(...plan.gaps());
            skipped.push(...plan.quintStatusSkips(req, u.name()));
            const extras = plan.quintInvariants(req);
            if (extras.isEmpty()) continue;
            const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS + UNREACH_BUDGET_MS - (this.#clock.now() - started));
            if (remaining < 3_000) {
              for (const e of extras) {
                skipped.push(DesignSkipped.of({ target: e.reqTarget(), reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run backend budget was exhausted before the refinement pass" }));
              }
              continue;
            }
            const base = u.lowered({ synthetics: false });
            let refinementObligations = base.obligations();
            let refinementIndex = base.index();
            let n = refinementObligations.count();
            for (const e of extras) {
              n += 1;
              const lowId = LoweredId.of(`OB-${n}`);
              refinementObligations = refinementObligations.add(e.loweredAs(lowId));
              refinementIndex = refinementIndex.withPassthrough(lowId.asString(), e.reqId().asString());
            }
            const lowered = base.extendedWith(refinementObligations, refinementIndex);
            const run = this.#siblingBackendClient.runLowered("quint", u, lowered, remaining);
            if (run.exit !== 0 || run.doc === null) {
              for (const e of extras) {
                skipped.push(DesignSkipped.of({ target: e.reqTarget(), reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `refinement pass could not run (${run.note.slice(0, 120)})` }));
              }
              continue;
            }
            const remapped = run.doc.remapVerdicts(u, lowered.index());
            if (remapped.unavailable !== null) {
              for (const e of extras) {
                skipped.push(DesignSkipped.of({ target: e.reqTarget(), reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `refinement pass degraded: ${remapped.unavailable}` }));
              }
              continue;
            }
            const interpreted = extras.interpret(remapped.findings, remapped.skipped, u.name());
            findings.push(...interpreted.findings);
            skipped.push(...interpreted.skipped);
          }
        },
      });
    }

    const finalMethod = method ?? INITIAL_METHOD_NAME;
    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: finalMethod,
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
