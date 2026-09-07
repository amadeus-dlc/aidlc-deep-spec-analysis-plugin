import { join } from "node:path";
import type { ManifestEntry } from "@deep-spec-analysis/doctor-domain";
import type { HarnessFileClient } from "@deep-spec-analysis/doctor-usecase";
import { readArtifactStat } from "@deep-spec-analysis/kernel-adapter";
import { ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

// マニフェスト設置検査の実 Gateway。不在だけを false とし、読取障害は Result で返す。
export class HarnessFileClientImplementation implements HarnessFileClient {
  readonly #root: string;

  constructor(config: { root: string }) {
    this.#root = config.root;
  }

  isInstalled(entry: ManifestEntry): Result<boolean, RepositoryError> {
    const stat = readArtifactStat(join(this.#root, entry.rel()));
    if (!stat.ok) return stat.error.kind === "not-found" ? ok(false) : stat;
    return ok(stat.value.isFile());
  }
}
