import type { DesignModel, DesignReport, DesignVerifyDirectory } from "@deep-spec/design-domain";
import type { ArtifactPath, FindingsSchema } from "@deep-spec/kernel-domain";
import { err, matchResult, ok, type Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { DesignVerifyDirectoryRepository } from "./port/design-verify-directory-repository.ts";

// 取得・不変な最終化・保存だけを調整する。保存した集約が出力境界へ届く。
export class DesignReportFinalizer {
  readonly #repository: DesignVerifyDirectoryRepository;
  readonly #findingsSchema: FindingsSchema;

  constructor(repository: DesignVerifyDirectoryRepository, findingsSchema: FindingsSchema) {
    this.#repository = repository;
    this.#findingsSchema = findingsSchema;
  }

  finalize(
    directory: ArtifactPath,
    report: DesignReport,
    model: DesignModel | null,
  ): Result<DesignVerifyDirectory, RepositoryError> {
    return matchResult(this.#repository.findByDirectory(directory), {
      err: (error): Result<DesignVerifyDirectory, RepositoryError> => err(error),
      ok: (loaded): Result<DesignVerifyDirectory, RepositoryError> => {
        const aggregate = loaded.finalizedWith(report, model, this.#findingsSchema);
        return matchResult(this.#repository.store(aggregate), {
          err: (error): Result<DesignVerifyDirectory, RepositoryError> => err(error),
          ok: (): Result<DesignVerifyDirectory, RepositoryError> => ok(aggregate),
        });
      },
    });
  }
}
