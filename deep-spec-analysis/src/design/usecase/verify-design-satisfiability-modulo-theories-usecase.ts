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
import type { RefinementSolverClient } from "./port/refinement-solver-client.ts";
import type { SiblingBackendClient } from "./port/sibling-backend-client.ts";
import type { VerifyDesignInput } from "./verify-design-input.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";

const METHOD = VerificationMethod.of("exhaustive");
const UNIT_WALL_TIMEOUT_MS = 55_000;
const RUN_BUDGET_MS = 60_000;
const REFINEMENT_DEADLINE_MS = 65_000;

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
    const id = DesignReportIdentifier.of(input.verifyDirectory, "smt");
    return matchResult(this.#acquirer.acquire(input.modelId, id, METHOD, input.verifyDirectory), {
      err: (outcome): VerifyDesignOutcome => outcome,
      ok: (model): VerifyDesignOutcome => this.#verify(input, id, model),
    });
  }

  #verify(input: VerifyDesignInput, id: DesignReportIdentifier, model: DesignModel): VerifyDesignOutcome {
    let report = DesignReport.started(id, model, METHOD);
    const started = this.#clock.now();
    for (const unit of model) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        report = report.unitTimedOut(unit);
        continue;
      }
      const lowered = unit.lowered({ synthetics: true });
      const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (remaining < 3_000) {
        report = report.unitTimedOut(unit);
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("smt", unit, lowered, remaining);
      report = run.recordedIn(report, model, unit, lowered);
      if (run.isBackendUnavailable()) {
        return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
          err: (error): VerifyDesignOutcome => ({ kind: "save-failed", error }),
          ok: (): VerifyDesignOutcome => ({ kind: "backend-unavailable" }),
        });
      }
    }
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    report = matchResult(materials, {
      err: (error) => report.refinementUnavailable(error.path, error.kind),
      ok: (context) => {
        const prepared = context.prepare(model);
        let refined = prepared.recordedIn(report);
        for (const plan of prepared) {
          const remaining = REFINEMENT_DEADLINE_MS - (this.#clock.now() - started);
          if (remaining < 5_000) {
            refined = plan.smtTimedOut(refined);
            continue;
          }
          refined = this.#refinementSolverClient.check(plan, Math.min(30_000, remaining)).recordedIn(refined);
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
