import {
  type DesignModel,
  DesignReport,
  DesignReportIdentifier,
  RefinementMaterialsIdentifier,
} from "@deep-spec/design-domain";
import { type FindingsSchema, VerificationMethod } from "@deep-spec/kernel-domain";
import { matchResult } from "@deep-spec/kernel-infrastructure";
import type { Clock } from "@deep-spec/kernel-usecase";
import { DesignReportFinalizer } from "./design-report-finalizer.ts";
import { DesignVerificationAcquirer } from "./design-verification-acquirer.ts";
import type { DesignModelRepository } from "./port/design-model-repository.ts";
import type { DesignVerifyDirectoryRepository } from "./port/design-verify-directory-repository.ts";
import type { RefinementMaterialsRepository } from "./port/refinement-materials-repository.ts";
import type { SiblingBackendClient } from "./port/sibling-backend-client.ts";
import type { VerifyDesignInput } from "./verify-design-input.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";

const INITIAL_METHOD = VerificationMethod.of("simulation");
const UNIT_WALL_TIMEOUT_MS = 50_000;
const RUN_BUDGET_MS = 50_000;
const UNREACH_BUDGET_MS = 70_000;

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
    const id = DesignReportIdentifier.of(input.verifyDirectory, "quint");
    return matchResult(this.#acquirer.acquire(input.modelId, id, INITIAL_METHOD, input.verifyDirectory), {
      err: (outcome): VerifyDesignOutcome => outcome,
      ok: (model): VerifyDesignOutcome => this.#verify(input, id, model),
    });
  }

  #verify(input: VerifyDesignInput, id: DesignReportIdentifier, model: DesignModel): VerifyDesignOutcome {
    let report = DesignReport.started(id, model, INITIAL_METHOD);
    const started = this.#clock.now();
    let probesUsed = 0;

    for (const unit of model) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        report = report.unitTimedOut(unit);
        continue;
      }
      const lowered = unit.lowered({ synthetics: false });
      const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (remaining < 3_000) {
        report = report.unitTimedOut(unit);
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("quint", unit, lowered, remaining);
      report = run.recordedIn(report, model, unit, lowered);
      if (run.isBackendUnavailable()) {
        return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
          err: (error): VerifyDesignOutcome => ({ kind: "save-failed", error }),
          ok: (): VerifyDesignOutcome => ({ kind: "backend-unavailable" }),
        });
      }
      if (!run.canInspectReachability()) continue;
      for (let machine of report.planReachability(unit, lowered)) {
        for (const probe of machine) {
          const probeRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, UNREACH_BUDGET_MS - (this.#clock.now() - started));
          if (probesUsed >= this.#unreachCap || probeRemaining < 3_000) continue;
          probesUsed += 1;
          machine = machine.withVerdict(probe, this.#siblingBackendClient.probeState(probe, probeRemaining));
        }
        report = machine.recordedIn(report, probesUsed >= this.#unreachCap, this.#unreachCap);
      }
    }

    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    report = matchResult(materials, {
      err: (error) => report.refinementUnavailable(error.path, error.kind),
      ok: (context) => {
        const prepared = context.prepare(model);
        let refined = prepared.recordedIn(report);
        for (const plan of prepared) {
          refined = plan.quintPreparedIn(refined);
          if (!plan.hasQuintInvariants()) continue;
          const remaining = Math.min(
            UNIT_WALL_TIMEOUT_MS,
            RUN_BUDGET_MS + UNREACH_BUDGET_MS - (this.#clock.now() - started),
          );
          if (remaining < 3_000) {
            refined = plan.quintTimedOut(refined);
            continue;
          }
          refined = plan.quintRecordedIn(refined, this.#siblingBackendClient.runRefinement(plan, remaining));
        }
        return refined;
      },
    });
    return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
      err: (error): VerifyDesignOutcome => ({ kind: "save-failed", error }),
      ok: (directory): VerifyDesignOutcome =>
        matchResult(materials, {
          err: (error): VerifyDesignOutcome => ({ kind: "acquisition-failed", error }),
          ok: (): VerifyDesignOutcome => ({ kind: "verified", directory }),
        }),
    });
  }
}
