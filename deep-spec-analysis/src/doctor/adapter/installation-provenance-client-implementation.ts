import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InstallationProvenanceClient, InstallationProvenanceRead } from "@deep-spec/doctor-usecase";

const SOURCE_KINDS = new Set(["local", "ref", "tag", "latest"]);

export class InstallationProvenanceClientImplementation implements InstallationProvenanceClient {
  readonly #path: string;

  constructor(config: { harnessRoot: string }) {
    this.#path = join(config.harnessRoot, "tools", "data", "deep-spec-analysis-install.json");
  }

  read(): InstallationProvenanceRead {
    if (!existsSync(this.#path)) return { kind: "missing" };
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(this.#path, "utf-8")) as unknown;
    } catch {
      return { kind: "malformed", reason: "file is not readable JSON" };
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { kind: "malformed", reason: "document must be an object" };
    }
    const row = value as Record<string, unknown>;
    if (
      typeof row.version !== "string" ||
      typeof row.ref !== "string" ||
      row.ref.length === 0 ||
      typeof row.source !== "string" ||
      !SOURCE_KINDS.has(row.source) ||
      typeof row.installed_at !== "string" ||
      row.installed_at.length === 0 ||
      typeof row.payload_sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/.test(row.payload_sha256)
    ) {
      return { kind: "malformed", reason: "required provenance fields are invalid" };
    }
    return { kind: "found", version: row.version, ref: row.ref, source: row.source };
  }
}
