import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { InstallationProvenance, InstallationSource, InstalledRelease, PluginVersion } from "@deep-spec/doctor-domain";
import type { InstallationProvenanceClient } from "@deep-spec/doctor-usecase";
import { ArtifactPath, ErrorMessage } from "@deep-spec/kernel-domain";

export class InstallationProvenanceClientImplementation implements InstallationProvenanceClient {
  readonly #path: string;

  constructor(config: { harnessRoot: string }) {
    this.#path = join(config.harnessRoot, "tools", "data", "deep-spec-analysis-install.json");
  }

  read(): InstallationProvenance {
    if (!existsSync(this.#path)) return InstallationProvenance.missing();
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(this.#path, "utf-8")) as unknown;
    } catch {
      return InstallationProvenance.malformed(ErrorMessage.of("file is not readable JSON"));
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return InstallationProvenance.malformed(ErrorMessage.of("document must be an object"));
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.version !== "string" ||
      typeof row.ref !== "string" ||
      row.ref.length === 0 ||
      typeof row.source !== "string" ||
      typeof row.installed_at !== "string" ||
      row.installed_at.length === 0 ||
      typeof row.payload_sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/.test(row.payload_sha256)
    ) {
      return InstallationProvenance.malformed(ErrorMessage.of("required provenance fields are invalid"));
    }
    const reference = ArtifactPath.parse(row.ref);
    const source = InstallationSource.parse(row.source);
    if (!reference.ok || !source.ok)
      return InstallationProvenance.malformed(ErrorMessage.of("required provenance fields are invalid"));
    const version = PluginVersion.parse(row.version);
    if (!version.ok)
      return InstallationProvenance.malformed(ErrorMessage.of("version is not a stable Semantic Version"));
    return InstallationProvenance.installed(InstalledRelease.of(version.value, source.value, reference.value));
  }
}
