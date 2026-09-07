import { InstallationManifest, InstalledStatus } from "@deep-spec-analysis/doctor-domain";
import { flatMapResult, ok, type Result, traverseResult } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { HarnessFileClient } from "./port/harness-file-client.ts";

// マニフェスト全行の実在判定（checks 配列の先頭ブロック——凍結順）。
export class CheckInstallationUseCase {
  readonly #files: HarnessFileClient;

  constructor(files: HarnessFileClient) {
    this.#files = files;
  }

  execute(): Result<readonly InstalledStatus[], RepositoryError> {
    return traverseResult([...InstallationManifest.standard()], (entry) =>
      flatMapResult(this.#files.isInstalled(entry), (present) => ok(InstalledStatus.of(entry, present))),
    );
  }
}
