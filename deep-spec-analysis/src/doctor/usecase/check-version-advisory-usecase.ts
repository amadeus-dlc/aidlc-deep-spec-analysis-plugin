import { PluginVersion } from "@deep-spec/doctor-domain";
import type { InstallationProvenanceClient } from "./port/installation-provenance-client.ts";
import type { ReleaseTagsClient } from "./port/release-tags-client.ts";
import { VersionAdvisory } from "./read-model/version-advisory.ts";

export class CheckVersionAdvisoryUseCase {
  readonly #provenance: InstallationProvenanceClient;
  readonly #releaseTags: ReleaseTagsClient;

  constructor(provenance: InstallationProvenanceClient, releaseTags: ReleaseTagsClient) {
    this.#provenance = provenance;
    this.#releaseTags = releaseTags;
  }

  async execute(): Promise<VersionAdvisory> {
    const provenance = this.#provenance.read();
    if (provenance.kind === "missing") return VersionAdvisory.provenanceMissing();
    if (provenance.kind === "malformed") return VersionAdvisory.provenanceMalformed(provenance.reason);

    const parsedVersion = PluginVersion.parse(provenance.version);
    if (!parsedVersion.ok) return VersionAdvisory.provenanceMalformed("version is not a stable Semantic Version");

    const installed = parsedVersion.value;
    const releaseTags = await this.#releaseTags.list();
    if (releaseTags.kind === "unavailable") {
      return VersionAdvisory.skipped({
        installedVersion: installed.asString(),
        source: provenance.source,
        ref: provenance.ref,
        reason: releaseTags.reason,
      });
    }

    let latest: PluginVersion | null = null;
    for (const raw of releaseTags.tags) {
      const candidate = PluginVersion.parse(raw);
      if (candidate.ok && (!latest || latest.isOlderThan(candidate.value))) latest = candidate.value;
    }
    if (!latest) {
      return VersionAdvisory.skipped({
        installedVersion: installed.asString(),
        source: provenance.source,
        ref: provenance.ref,
        reason: "GitHub returned no stable Semantic Versioning tag",
      });
    }

    const values = {
      installedVersion: installed.asString(),
      latestVersion: latest.asTag(),
      source: provenance.source,
      ref: provenance.ref,
    };
    return installed.isOlderThan(latest) ? VersionAdvisory.updateAvailable(values) : VersionAdvisory.current(values);
  }
}
