import { type FindingsSchema, VerificationMethod } from "@deep-spec/kernel-domain";
import { matchResult } from "@deep-spec/kernel-infrastructure";
import { VerificationReport, VerificationReportIdentifier } from "@deep-spec/requirements-domain";
import type { FormalModelRepository } from "./port/formal-model-repository.ts";
import type { QuintClient } from "./port/quint-client.ts";
import type { VerificationDirectoryRepository } from "./port/verification-directory-repository.ts";
import { VerificationReportFinalizer } from "./verification-report-finalizer.ts";
import type { VerifyQuintOutcome } from "./verify-quint-outcome.ts";
import type { VerifyRequirementsQuintInput } from "./verify-requirements-quint-input.ts";

export class VerifyRequirementsQuintUseCase {
  readonly #formalModelRepository: FormalModelRepository;
  readonly #client: QuintClient;
  readonly #finalizer: VerificationReportFinalizer;

  constructor(
    formalModelRepository: FormalModelRepository,
    verificationDirectoryRepository: VerificationDirectoryRepository,
    findingsSchema: FindingsSchema,
    client: QuintClient,
  ) {
    this.#formalModelRepository = formalModelRepository;
    this.#client = client;
    this.#finalizer = new VerificationReportFinalizer(verificationDirectoryRepository, findingsSchema);
  }

  execute(input: VerifyRequirementsQuintInput): VerifyQuintOutcome {
    const id = VerificationReportIdentifier.of(input.verifyDirectory, "quint");
    return matchResult(this.#formalModelRepository.findById(input.modelId), {
      err: (error): VerifyQuintOutcome => {
        if (error.kind === "not-found") return { kind: "not-applicable" };
        if (error.kind === "io-failed") return { kind: "acquisition-failed", error };
        return matchResult(
          this.#finalizer.finalize(
            input.verifyDirectory,
            VerificationReport.irUnreadable(id, "simulation", error.cause),
            null,
          ),
          {
            err: (error): VerifyQuintOutcome => ({ kind: "save-failed", error }),
            ok: () => ({ kind: "model-unreadable" }),
          },
        );
      },
      ok: (model) =>
        matchResult(model.prepareVerification(id, VerificationMethod.of("simulation")), {
          err: (report): VerifyQuintOutcome =>
            matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
              err: (error): VerifyQuintOutcome => ({ kind: "save-failed", error }),
              ok: () => ({ kind: "version-mismatch" }),
            }),
          ok: (prepared) => {
            const checked = this.#client.check(prepared);
            return matchResult(
              this.#finalizer.finalize(input.verifyDirectory, checked.reportFor(prepared, id), prepared),
              {
                err: (error): VerifyQuintOutcome => ({ kind: "save-failed", error }),
                ok: (directory) =>
                  checked.match<VerifyQuintOutcome>({
                    unavailable: () => ({ kind: "backend-unavailable" }),
                    uncompilable: () => ({ kind: "machine-uncompilable" }),
                    checked: () => ({ kind: "verified", directory }),
                  }),
              },
            );
          },
        }),
    });
  }
}
