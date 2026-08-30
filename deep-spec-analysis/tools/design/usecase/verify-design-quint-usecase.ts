// deep-spec-design-verify-quint の interactor。Phase 1-2（lowering → v1 quint
// 兄弟 → remap）＋到達性プローブ（bounded のみ・RUN ごとの上限つき）＋
// Phase 3（refinement の動的パス：alpha(P) が機械の不変量面に合流し、違反
// トレースは到達可能な refinement 破れ。シナリオ再生・イベントシミュレーション・
// enabledness は v1 では SMT 専用の capability skip）を編成する。
// mapping-gap は map と両 IR の純関数なので両バックエンド文書が同一に運ぶ。

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
  designBackendUnavailableReport,
  designCrossCheckReport,
  designIrUnreadableReport,
  designVersionMismatchReport,
  lowerUnit,
  remapUnitDocument,
  RefinementMaterialsId,
} from "../domain/index.ts";
import type { LoweredUnit } from "../domain/index.ts";
import {
  planUnitRefinement,
  quintRefinementStatusSkips,
  refinementQuintInvariants,
} from "../../refinement/domain/index.ts";
import type { DesignModelRepository } from "./design-model-repository.ts";
import type { DesignReportRepository } from "./design-report-repository.ts";
import type { RefinementMaterialsRepository } from "./refinement-context-repository.ts";
import type { SiblingBackendClient } from "./sibling-backend-client.ts";
import type { VerifyDesignInput } from "./verify-design-smt-usecase.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";

const BACKEND = "quint";
const CROSS_CHECK_BACKEND = "cross-check";
const UNIT_WALL_TIMEOUT_MS = 50_000;
const RUN_BUDGET_MS = 50_000;
const UNREACH_BUDGET_MS = 70_000;
const BOUND_STEPS = 8; // v1 バックエンドの MAX_STEPS を写す

export class VerifyDesignQuintUseCase {
  readonly #designModelRepository: DesignModelRepository;
  readonly #designReportRepository: DesignReportRepository;
  readonly #siblingBackendClient: SiblingBackendClient;
  readonly #refinementMaterialsRepository: RefinementMaterialsRepository;
  readonly #clock: Clock;
  readonly #unreachCap: number;

  constructor(
    designModelRepository: DesignModelRepository,
    designReportRepository: DesignReportRepository,
    siblingBackendClient: SiblingBackendClient,
    refinementMaterialsRepository: RefinementMaterialsRepository,
    clock: Clock,
    unreachCap: number,
  ) {
    this.#designModelRepository = designModelRepository;
    this.#designReportRepository = designReportRepository;
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#clock = clock;
    this.#unreachCap = unreachCap;
  }

  execute(input: VerifyDesignInput): VerifyDesignOutcome {
    const id = DesignReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#designModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(designIrUnreadableReport(id, "simulation", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const { model, irHash } = acquired.value;

    if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
      // 旧実装は conform 前の skip 数を verdict 行に載せていた——凍結挙動。
      const mismatch = designVersionMismatchReport(id, model, irHash, "simulation");
      const saved = this.#persist(mismatch);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "version-mismatch", skippedCount: mismatch.skippedCount() };
    }

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
          skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before this unit" });
        }
        continue;
      }
      const lowered = lowerUnit(u, { synthetics: false });
      // 子に run budget を超えて生き延びさせない。
      const mainRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (mainRemaining < 3_000) {
        for (const t of u.allTargets()) {
          skipped.push({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before this unit" });
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("quint", u, lowered, mainRemaining);
      if (run.exit === 127) {
        const reason =
          (run.doc?.kind === "unavailable" ? run.doc.reason : null) ?? "quint CLI could not be executed by the lowered v1 backend";
        const saved = this.#persist(designBackendUnavailableReport(id, model, irHash, method ?? "simulation", reason, "quint CLI missing"));
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
      const remapped = remapUnitDocument(u, lowered, run.doc);
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

      // 到達不能状態の検出（FR8.4）：bounded モードのみ・予算キャップつき。
      for (const sm of [...u.machines()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const attrPath = lowered.index.attrPathOfMachine(sm.id) ?? `${sm.entity}.${sm.attribute}`;
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
          const probeRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, UNREACH_BUDGET_MS - (this.#clock.now() - started));
          if (probesUsed >= this.#unreachCap || probeRemaining < 3_000) {
            leftover.push(state);
            continue;
          }
          probesUsed += 1;
          const probe = this.#siblingBackendClient.probeState(u, lowered, attrPath, state, probeRemaining);
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
            reason: probesUsed >= this.#unreachCap ? "timeout" : "unavailable",
            unit: u.name(),
            detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id} (per-run cap ${this.#unreachCap} / budget reached, or the probe run failed)`,
          });
        }
      }
    }

    // --- Phase 3（動的）：alpha(P) が機械の不変量面に合流する -----------------
    const context = this.#refinementMaterialsRepository.findById(RefinementMaterialsId.ofModel(input.modelId));
    let inputs: readonly DesignInputAnchor[] | undefined;
    if (context.kind === "active") {
      const req = context.requirements;
      const reqTargets = req.allTargetIds();
      const skipAll = (reason: string, detail: string): void => {
        for (const u of model.units()) {
          for (const t of reqTargets) skipped.push({ target: t, reason, unit: u.name(), detail });
        }
      };
      if (context.map.kind === "absent") {
        skipAll("absent-input", context.map.error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
      } else if (!context.map.map.requirementsIrHash().equals(req.hash())) {
        skipAll("stale-input", "the refinement map's requirementsIrHash no longer matches the requirements formal model — re-author the map");
      } else if (!context.map.map.designIrHash().equals(irHash)) {
        skipAll("stale-input", "the refinement map's designIrHash no longer matches this design IR — re-author the map");
      } else {
        inputs = context.map.inputs;
        for (const u of model.units()) {
          const unitMap = context.map.map.unitMapOf(u.id());
          if (!unitMap) {
            for (const t of reqTargets) {
              skipped.push({ target: t, reason: "absent-input", unit: u.name(), detail: `the refinement map has no entry for unit ${u.name()}` });
            }
            continue;
          }
          const plan = planUnitRefinement(u, unitMap, req, context.map.mapArtifact);
          findings.push(...plan.gaps);
          skipped.push(...quintRefinementStatusSkips(plan, req, u.name()));
          const extras = refinementQuintInvariants(plan, req);
          if (extras.length === 0) continue;
          const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS + UNREACH_BUDGET_MS - (this.#clock.now() - started));
          if (remaining < 3_000) {
            for (const e of extras) {
              skipped.push({ target: e.reqId, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before the refinement pass" });
            }
            continue;
          }
          const base = lowerUnit(u, { synthetics: false });
          let refinementObligations = base.obligations;
          let refinementIndex = base.index;
          let n = refinementObligations.count();
          for (const e of extras) {
            n += 1;
            const lowId = `OB-${n}`;
            refinementObligations = refinementObligations.add({ id: lowId, nature: "invariant", frRefs: e.frRefs, assert: e.expr });
            refinementIndex = refinementIndex.withPassthrough(lowId, e.reqId);
          }
          const lowered: LoweredUnit = {
            obligations: refinementObligations,
            scenarios: base.scenarios,
            background: base.background,
            index: refinementIndex,
          };
          const run = this.#siblingBackendClient.runLowered("quint", u, lowered, remaining);
          if (run.exit !== 0 || run.doc === null) {
            for (const e of extras) {
              skipped.push({ target: e.reqId, reason: "unavailable", unit: u.name(), detail: `refinement pass could not run (${run.note.slice(0, 120)})` });
            }
            continue;
          }
          const remapped = remapUnitDocument(u, lowered, run.doc);
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
    const conformed = this.#designReportRepository.conformedOf(
      DesignReport.compose({
        id,
        irVersion: model.irVersion(),
        irHash,
        method: finalMethod,
        findings: DesignFindings.of(findings),
        skipped: DesignSkips.of(skipped),
        ...(inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {}),
        checked: CheckedUnits.of(checkedUnits),
      }),
    );
    const saved = this.#designReportRepository.save(conformed);
    if (!saved.ok) return { kind: "save-failed", error: saved.error };
    const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
    if (!cross.ok) return { kind: "save-failed", error: cross.error };
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
      method: finalMethod,
    };
  }

  #persist(report: DesignReport): Result<void, RepositoryError> {
    return this.#designReportRepository.save(this.#designReportRepository.conformedOf(report));
  }

  // 自文書を書いた後に、同一ディレクトリの全バックエンド文書からクロス
  // チェックを再計算する（最後の書き手が勝ち、全書き手が同一バイトへ収束）。
  #recomputeCrossCheck(model: DesignModel, irHash: ContentHash, directory: ArtifactPath): Result<void, RepositoryError> {
    const siblings = this.#designReportRepository.findAllByDirectory(directory);
    // 旧挙動: ディレクトリが読めないときは黙って諦める（自文書は書けている）。
    if (!siblings.ok) return ok(undefined);
    return this.#persist(designCrossCheckReport(DesignReportId.of(directory, CROSS_CHECK_BACKEND), model, irHash, siblings.value));
  }
}
