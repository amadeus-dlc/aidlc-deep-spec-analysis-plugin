import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type DesignArtifactReference, FindingCount, StructuralObservation } from "@deep-spec/doctor-domain";
import type { ReferenceCheckBackendClient } from "@deep-spec/doctor-usecase";
import type { ReferenceCheckBackendClientConfiguration } from "./reference-check-backend-client-configuration.ts";

// refcheck report-only 実行の実 Gateway——spawn 維持（故障隔離・15s timeout
// 意味論の保存、移行 PR9/#22）。旧 refcheckReportOnly からの逐語移植:
// ツール欠如・error・非 0 exit・壊れた verdict はすべて null（不算入）。
export class ReferenceCheckBackendClientImplementation implements ReferenceCheckBackendClient {
  readonly #root: string;

  constructor(config: ReferenceCheckBackendClientConfiguration) {
    this.#root = config.root;
  }

  observe(artifact: DesignArtifactReference): StructuralObservation {
    const findings = this.#readFindings(artifact);
    if (findings === null) return StructuralObservation.of(artifact, null);
    const parsed = FindingCount.parse(findings);
    return StructuralObservation.of(artifact, parsed.ok ? parsed.value : null);
  }

  #readFindings(artifact: DesignArtifactReference): number | null {
    const script = join(this.#root, "tools", artifact.tool().asString());
    if (!existsSync(script)) return null;
    const res = spawnSync(
      "bun",
      [script, "--stage", "doctor", "--output-path", artifact.artifactPath().asString(), "--report-only"],
      {
        encoding: "utf-8",
        timeout: 15_000,
      },
    );
    if (res.error || res.status !== 0) return null;
    try {
      const lines = (res.stdout ?? "").trim().split("\n");
      const verdict = JSON.parse(lines[lines.length - 1] ?? "{}") as { findings_count?: number };
      return typeof verdict.findings_count === "number" ? verdict.findings_count : null;
    } catch {
      return null;
    }
  }
}
