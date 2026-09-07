import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { type DesignArtifactReference, FindingCount, StructuralObservation } from "@deep-spec-analysis/doctor-domain";
import type { ReferenceCheckBackendClient } from "@deep-spec-analysis/doctor-usecase";
import { readArtifactStat } from "@deep-spec-analysis/kernel-adapter";
import { ErrorMessage } from "@deep-spec-analysis/kernel-domain";
import { isObject, type Json, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { ReferenceCheckBackendClientConfiguration } from "./reference-check-backend-client-configuration.ts";

// refcheck report-only 実行の実 Gateway。故障・不正verdictは未計測として保持し、
// pass:false + finding 0 のような曖昧な成功は受け入れない。
export class ReferenceCheckBackendClientImplementation implements ReferenceCheckBackendClient {
  readonly #root: string;

  constructor(config: ReferenceCheckBackendClientConfiguration) {
    this.#root = config.root;
  }

  observe(artifact: DesignArtifactReference): StructuralObservation {
    const script = join(this.#root, "tools", artifact.tool().asString());
    const scriptStat = readArtifactStat(script);
    if (!scriptStat.ok) return StructuralObservation.unavailable(artifact, this.#error(scriptStat.error));
    const result = spawnSync(
      "bun",
      [script, "--stage", "doctor", "--output-path", artifact.artifactPath().asString(), "--report-only"],
      { encoding: "utf-8", timeout: 15_000 },
    );
    if (result.error) return StructuralObservation.unavailable(artifact, this.#message(String(result.error)));
    if (result.status !== 0)
      return StructuralObservation.unavailable(artifact, this.#message(`backend exited with status ${result.status}`));
    const verdict = this.#parseVerdict(result.stdout ?? "");
    if (!verdict.ok) return StructuralObservation.unavailable(artifact, this.#message(verdict.error));
    if (!verdict.value.pass && verdict.value.findingsCount === 0)
      return StructuralObservation.unavailable(
        artifact,
        this.#message("backend returned a failed zero-finding verdict"),
      );
    const findings = FindingCount.parse(verdict.value.findingsCount);
    if (!findings.ok) return StructuralObservation.unavailable(artifact, this.#message(JSON.stringify(findings.error)));
    if (verdict.value.skippedCount > 0)
      return StructuralObservation.partial(
        artifact,
        findings.value,
        this.#message("backend skipped one or more checks"),
      );
    return StructuralObservation.of(artifact, findings.value);
  }

  #error(error: RepositoryError): ErrorMessage {
    return this.#message("cause" in error ? `${error.kind}: ${error.cause}` : error.kind);
  }

  #parseVerdict(stdout: string): Result<{ pass: boolean; findingsCount: number; skippedCount: number }, string> {
    const line = stdout.trim().split("\n").pop() ?? "";
    let raw: Json;
    try {
      raw = JSON.parse(line) as Json;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    if (
      !isObject(raw) ||
      raw.note === "not-applicable" ||
      typeof raw.pass !== "boolean" ||
      typeof raw.findings_count !== "number" ||
      typeof raw.skipped_count !== "number" ||
      !Number.isSafeInteger(raw.findings_count) ||
      raw.findings_count < 0 ||
      !Number.isSafeInteger(raw.skipped_count) ||
      raw.skipped_count < 0
    )
      return { ok: false, error: "backend verdict lacks valid checked pass/findings_count/skipped_count" };
    return {
      ok: true,
      value: { pass: raw.pass, findingsCount: raw.findings_count, skippedCount: raw.skipped_count },
    };
  }

  #message(raw: string): ErrorMessage {
    const parsed = ErrorMessage.parse(raw);
    return parsed.ok ? parsed.value : ErrorMessage.of("reference-check backend failed");
  }
}
