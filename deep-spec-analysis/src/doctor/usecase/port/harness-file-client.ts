import type { ManifestEntry } from "@deep-spec/doctor-domain";

export interface HarnessFileClient {
  isInstalled(entry: ManifestEntry): boolean;
}
