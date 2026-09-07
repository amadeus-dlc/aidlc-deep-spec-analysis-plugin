import type { ManifestEntry } from "@deep-spec-analysis/doctor-domain";
import type { Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

export interface HarnessFileClient {
  isInstalled(entry: ManifestEntry): Result<boolean, RepositoryError>;
}
