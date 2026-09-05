import { type FindingsSchema, VerificationMethod } from "@deep-spec/kernel-domain";
import { matchResult } from "@deep-spec/kernel-infrastructure";
import { VerificationReport, VerificationReportIdentifier } from "@deep-spec/requirements-domain";
import type { FormalModelRepository } from "./port/formal-model-repository.ts";
import type { VerificationDirectoryRepository } from "./port/verification-directory-repository.ts";
import type { Z3SolverClient } from "./port/z3-solver-client.ts";
import { VerificationReportFinalizer } from "./verification-report-finalizer.ts";
import type { VerifyRequirementsSatisfiabilityModuloTheoriesInput } from "./verify-requirements-satisfiability-modulo-theories-input.ts";
import type { VerifySatisfiabilityModuloTheoriesOutcome } from "./verify-satisfiability-modulo-theories-outcome.ts";

export class VerifyRequirementsSatisfiabilityModuloTheoriesUseCase {
  readonly #formalModelRepository: FormalModelRepository;
  readonly #client: Z3SolverClient;
  readonly #finalizer: VerificationReportFinalizer;

  constructor(
    formalModelRepository: FormalModelRepository,
    verificationDirectoryRepository: VerificationDirectoryRepository,
    findingsSchema: FindingsSchema,
    client: Z3SolverClient,
  ) {
    this.#formalModelRepository = formalModelRepository;
    this.#client = client;
    this.#finalizer = new VerificationReportFinalizer(verificationDirectoryRepository, findingsSchema);
  }

  execute(input: VerifyRequirementsSatisfiabilityModuloTheoriesInput): VerifySatisfiabilityModuloTheoriesOutcome {
    const id = VerificationReportIdentifier.of(input.verifyDirectory, "smt");
    return matchResult(this.#formalModelRepository.findById(input.modelId), {
      err: (error): VerifySatisfiabilityModuloTheoriesOutcome => {
        if (error.kind === "not-found") return { kind: "not-applicable" };
        if (error.kind === "io-failed") return { kind: "acquisition-failed", error };
        return matchResult(
          this.#finalizer.finalize(
            input.verifyDirectory,
            VerificationReport.irUnreadable(id, "exhaustive", error.cause),
            null,
          ),
          {
            err: (error): VerifySatisfiabilityModuloTheoriesOutcome => ({ kind: "save-failed", error }),
            ok: () => ({ kind: "model-unreadable" }),
          },
        );
      },
      ok: (model) =>
        matchResult(model.prepareVerification(id, VerificationMethod.of("exhaustive")), {
          err: (report): VerifySatisfiabilityModuloTheoriesOutcome =>
            matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
              err: (error): VerifySatisfiabilityModuloTheoriesOutcome => ({ kind: "save-failed", error }),
              ok: () => ({ kind: "version-mismatch" }),
            }),
          ok: (prepared) => {
            const checked = this.#client.check(prepared);
            return matchResult(
              this.#finalizer.finalize(input.verifyDirectory, checked.reportFor(prepared, id), prepared),
              {
                err: (error): VerifySatisfiabilityModuloTheoriesOutcome => ({ kind: "save-failed", error }),
                ok: (directory) =>
                  checked.match<VerifySatisfiabilityModuloTheoriesOutcome>({
                    unavailable: () => ({ kind: "solver-unavailable" }),
                    solved: () => ({ kind: "verified", directory }),
                  }),
              },
            );
          },
        }),
    });
  }
}
