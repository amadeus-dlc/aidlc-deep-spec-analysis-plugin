import { join } from "node:path";
import {
  InstallationProvenance,
  InstallationSource,
  InstalledRelease,
  PluginVersion,
} from "@deep-spec-analysis/doctor-domain";
import type { InstallationProvenanceClient } from "@deep-spec-analysis/doctor-usecase";
import { readArtifactText } from "@deep-spec-analysis/kernel-adapter";
import { ArtifactPath, ErrorMessage } from "@deep-spec-analysis/kernel-domain";

export class InstallationProvenanceClientImplementation implements InstallationProvenanceClient {
  readonly #path: string;

  constructor(config: { harnessRoot: string }) {
    this.#path = join(config.harnessRoot, "tools", "data", "deep-spec-analysis-install.json");
  }

  read(): InstallationProvenance {
    const read = readArtifactText(this.#path);
    if (!read.ok) {
      if (read.error.kind === "not-found") return InstallationProvenance.missing();
      const reason = ErrorMessage.parse(read.error.cause);
      return InstallationProvenance.malformed(
        reason.ok ? reason.value : ErrorMessage.of("provenance read failure could not be represented"),
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(read.value) as unknown;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
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
