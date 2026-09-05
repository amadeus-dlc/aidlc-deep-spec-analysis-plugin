import type { ArtifactPath, FindingsSchema } from "@deep-spec/kernel-domain";
import { flatMapResult, ok, type Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { RequirementsModel, VerificationDirectory, VerificationReport } from "@deep-spec/requirements-domain";
import type { VerificationDirectoryRepository } from "./port/verification-directory-repository.ts";

// 保存済み集約を返すCQS例外。適合・クロスチェックは集約が所有し、ここは取得と保存を調整する。
export class VerificationReportFinalizer {
  readonly #repository: VerificationDirectoryRepository;
  readonly #schema: FindingsSchema;

  constructor(repository: VerificationDirectoryRepository, schema: FindingsSchema) {
    this.#repository = repository;
    this.#schema = schema;
  }

  finalize(
    directory: ArtifactPath,
    report: VerificationReport,
    model: RequirementsModel | null,
  ): Result<VerificationDirectory, RepositoryError> {
    return flatMapResult(this.#repository.findByDirectory(directory), (loaded) => {
      const finalized = loaded.finalizedWith(report, model, this.#schema);
      return flatMapResult(this.#repository.store(finalized), () => ok(finalized));
    });
  }
}
