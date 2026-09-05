import type { VersionAdvisory } from "@deep-spec/doctor-domain";
import type { InstallationProvenanceClient } from "./port/installation-provenance-client.ts";
import type { ReleaseTagsClient } from "./port/release-tags-client.ts";

export class CheckVersionAdvisoryUseCase {
  readonly #provenance: InstallationProvenanceClient;
  readonly #releaseTags: ReleaseTagsClient;
  constructor(provenance: InstallationProvenanceClient, releaseTags: ReleaseTagsClient) {
    this.#provenance = provenance;
    this.#releaseTags = releaseTags;
  }
  async execute(): Promise<VersionAdvisory> {
    return this.#provenance.read().match({
      unavailable: async (advisory) => advisory,
      installed: async (installed) => (await this.#releaseTags.list()).advise(installed),
    });
  }
}
