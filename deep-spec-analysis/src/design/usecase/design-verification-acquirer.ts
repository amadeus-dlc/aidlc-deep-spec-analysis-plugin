import {
  type DesignModel,
  type DesignModelIdentifier,
  DesignReport,
  type DesignReportIdentifier,
} from "@deep-spec/design-domain";
import type { ArtifactPath, VerificationMethod } from "@deep-spec/kernel-domain";
import { err, matchResult, ok, type Result } from "@deep-spec/kernel-infrastructure";
import type { DesignAcquisitionTerminal } from "./design-acquisition-terminal.ts";
import type { DesignReportFinalizer } from "./design-report-finalizer.ts";
import type { DesignModelRepository } from "./port/design-model-repository.ts";

export class DesignVerificationAcquirer {
  readonly #repository: DesignModelRepository;
  readonly #finalizer: DesignReportFinalizer;

  constructor(repository: DesignModelRepository, finalizer: DesignReportFinalizer) {
    this.#repository = repository;
    this.#finalizer = finalizer;
  }

  acquire(
    modelId: DesignModelIdentifier,
    reportId: DesignReportIdentifier,
    method: VerificationMethod,
    directory: ArtifactPath,
  ): Result<DesignModel, DesignAcquisitionTerminal> {
    return matchResult(this.#repository.findById(modelId), {
      err: (error): Result<DesignModel, DesignAcquisitionTerminal> => {
        if (error.kind === "not-found") return err({ kind: "not-applicable" });
        if (error.kind === "io-failed") return err({ kind: "acquisition-failed", error });
        return matchResult(
          this.#finalizer.finalize(directory, DesignReport.irUnreadable(reportId, method, error.cause), null),
          {
            err: (error): Result<DesignModel, DesignAcquisitionTerminal> => err({ kind: "save-failed", error }),
            ok: (): Result<DesignModel, DesignAcquisitionTerminal> => err({ kind: "model-unreadable" }),
          },
        );
      },
      ok: (model): Result<DesignModel, DesignAcquisitionTerminal> =>
        matchResult(model.prepareVerification(reportId, method), {
          ok: (ready): Result<DesignModel, DesignAcquisitionTerminal> => ok(ready),
          err: (report): Result<DesignModel, DesignAcquisitionTerminal> =>
            matchResult(this.#finalizer.finalize(directory, report, model), {
              err: (error): Result<DesignModel, DesignAcquisitionTerminal> => err({ kind: "save-failed", error }),
              ok: (): Result<DesignModel, DesignAcquisitionTerminal> => err({ kind: "version-mismatch", report }),
            }),
        }),
    });
  }
}
