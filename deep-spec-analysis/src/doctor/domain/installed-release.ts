import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { InstallationSource } from "./installation-source.ts";
import type { PluginVersion } from "./plugin-version.ts";
import { VersionAdvisory } from "./version-advisory.ts";

export class InstalledRelease {
  readonly #version: PluginVersion;
  readonly #source: InstallationSource;
  readonly #reference: ArtifactPath;
  private constructor(version: PluginVersion, source: InstallationSource, reference: ArtifactPath) {
    this.#version = version;
    this.#source = source;
    this.#reference = reference;
  }
  static of(version: PluginVersion, source: InstallationSource, reference: ArtifactPath): InstalledRelease {
    return new InstalledRelease(version, source, reference);
  }
  assessLatest(latest: PluginVersion): VersionAdvisory {
    return this.#version.isOlderThan(latest)
      ? VersionAdvisory.updateAvailable(this, latest)
      : VersionAdvisory.current(this, latest);
  }
  version(): PluginVersion {
    return this.#version;
  }
  source(): InstallationSource {
    return this.#source;
  }
  reference(): ArtifactPath {
    return this.#reference;
  }
}
