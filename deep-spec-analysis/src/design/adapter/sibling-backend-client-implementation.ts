// SiblingBackendClient の実 Gateway 実装。型付き lowering を契約1 文書へ
// 直列化して一時レコードへ形式モデルとして書き（wrapper 文言は凍結）、
// v1 entry（verify-smt / verify-quint）を spawn して findings 文書を読み戻し、
// 型付き判定面へ解体して返す。到達性プローブの文書組換えはここが持ち、
// 判定はドメインの値としてそのまま返す。兄弟 entry のパス・作業ディレクトリは entry が注入する
// （import.meta / process.* は entry 限定のため）。
// 旧 runSiblingBackend からの逐語移植。

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DesignUnit } from "@deep-spec-analysis/design-domain";
import {
  type LoweredUnit,
  type ReachabilityProbe,
  ReachabilityVerdict,
  SiblingVerificationResult,
  type UnitRefinementPlan,
} from "@deep-spec-analysis/design-domain";
import type { SiblingBackendClient } from "@deep-spec-analysis/design-usecase";
import { readArtifactText } from "@deep-spec-analysis/kernel-adapter";
import { ErrorMessage } from "@deep-spec-analysis/kernel-domain";
import { err, type Json, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import { renderLoweredDocument } from "./lowered-document-serializer.ts";
import { reachabilityVariant } from "./reachability-variant.ts";
import type { SiblingBackendClientConfiguration } from "./sibling-backend-client-configuration.ts";
import { parseSiblingVerdictDocument } from "./sibling-document-parser.ts";

function errorMessageOrFallback(raw: string, fallback: string): ErrorMessage {
  const parsed = ErrorMessage.parse(raw);
  return parsed.ok ? parsed.value : ErrorMessage.of(fallback);
}

export class SiblingBackendClientImplementation implements SiblingBackendClient {
  readonly #config: SiblingBackendClientConfiguration;

  constructor(config: SiblingBackendClientConfiguration) {
    this.#config = config;
  }

  runLowered(
    backend: "smt" | "quint",
    unit: DesignUnit,
    lowered: LoweredUnit,
    wallTimeoutMs: number,
  ): SiblingVerificationResult {
    const run = this.#spawn(backend, renderLoweredDocument(unit, lowered), wallTimeoutMs);
    const refinementFailure = ErrorMessage.of(`refinement pass could not run (${run.note.slice(0, 120)})`);
    if (!run.document.ok)
      return SiblingVerificationResult.incomplete(
        errorMessageOrFallback(
          `lowered v1 backend findings document could not be read (${this.#errorDetail(run.document.error)})`,
          "lowered v1 backend findings document could not be read",
        ),
        refinementFailure,
      );
    const document = run.document.value === null ? null : parseSiblingVerdictDocument(run.document.value);
    if (run.exit === 127) {
      const reason =
        document?.unavailableReason() ??
        (backend === "smt"
          ? "z3 could not be executed by the lowered v1 backend"
          : "quint CLI could not be executed by the lowered v1 backend");
      const parsedReason = ErrorMessage.parse(reason);
      return SiblingVerificationResult.backendUnavailable(
        parsedReason.ok
          ? parsedReason.value
          : ErrorMessage.of("lowered backend reported an invalid unavailable reason"),
        refinementFailure,
      );
    }
    if (document === null)
      return SiblingVerificationResult.incomplete(
        ErrorMessage.of(`lowered v1 backend produced no findings document (${run.note.slice(0, 160)})`),
        refinementFailure,
      );
    return SiblingVerificationResult.completed(document, run.exit === 0 ? null : refinementFailure);
  }

  runRefinement(plan: UnitRefinementPlan, wallTimeoutMs: number): SiblingVerificationResult {
    const lowered = plan.loweredForQuint();
    if (!lowered.ok) {
      const reason = ErrorMessage.of(`refinement lowering failed: ${lowered.error.kind}`);
      return SiblingVerificationResult.incomplete(reason, reason);
    }
    return this.runLowered("quint", plan.unit(), lowered.value, wallTimeoutMs);
  }

  probeState(probe: ReachabilityProbe, wallTimeoutMs: number): ReachabilityVerdict {
    const variant = reachabilityVariant(
      renderLoweredDocument(probe.unit(), probe.lowered()),
      probe.attributePath(),
      probe.state(),
    );
    const run = this.#spawn("quint", variant, wallTimeoutMs);
    if (run.exit !== 0 || !run.document.ok || run.document.value === null) return ReachabilityVerdict.unverified();
    return parseSiblingVerdictDocument(run.document.value).reachabilityOf(probe.attributePath(), probe.state());
  }

  #spawn(
    backend: "smt" | "quint",
    loweredDoc: Json,
    wallTimeoutMs: number,
  ): { exit: number | null; document: Result<Json | null, RepositoryError>; note: string } {
    const tool = this.#config.siblingToolPaths[backend];
    const work = mkdtempSync(join(tmpdir(), "deep-spec-design-lower-"));
    try {
      const modelPath = join(work, "deep-spec-analysis-formal-model.md");
      writeFileSync(
        modelPath,
        `# Lowered design unit\n\n\`\`\`json\n${JSON.stringify(loweredDoc, null, 2)}\n\`\`\`\n`,
        "utf-8",
      );
      const res = spawnSync(
        "bun",
        [tool, "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath],
        {
          encoding: "utf-8",
          timeout: wallTimeoutMs,
          cwd: this.#config.workingDirectory,
          ...(this.#config.spawnEnvironment ? { env: this.#config.spawnEnvironment as NodeJS.ProcessEnv } : {}),
        },
      );
      const findingsPath = join(work, "deep-spec-verify", `${backend}.json`);
      const document = this.#readDocument(findingsPath);
      const note = res.error ? String(res.error) : ((res.stdout ?? "").trim().split("\n").pop() ?? "");
      return {
        exit: res.status,
        document,
        note,
      };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }

  #readDocument(path: string): Result<Json | null, RepositoryError> {
    const text = readArtifactText(path);
    if (!text.ok) return text.error.kind === "not-found" ? ok(null) : err(text.error);
    try {
      return ok(JSON.parse(text.value) as Json);
    } catch (error) {
      return err({
        kind: "corrupt",
        path,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  #errorDetail(error: RepositoryError): string {
    switch (error.kind) {
      case "not-found":
        return `not-found: ${error.path}`;
      case "io-failed":
        return `io-failed: ${error.cause}`;
      case "corrupt":
        return `corrupt: ${error.cause}`;
    }
  }
}
