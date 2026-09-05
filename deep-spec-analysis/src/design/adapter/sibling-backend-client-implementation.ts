// SiblingBackendClient の実 Gateway 実装。型付き lowering を契約1 文書へ
// 直列化して一時レコードへ形式モデルとして書き（wrapper 文言は凍結）、
// v1 entry（verify-smt / verify-quint）を spawn して findings 文書を読み戻し、
// 型付き判定面へ解体して返す。到達性プローブの文書組換えはここが持ち、
// 判定はドメインの値としてそのまま返す。兄弟 entry のパス・作業ディレクトリは entry が注入する
// （import.meta / process.* は entry 限定のため）。
// 旧 runSiblingBackend からの逐語移植。

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DesignUnit } from "@deep-spec/design-domain";
import {
  type LoweredUnit,
  type ReachabilityProbe,
  ReachabilityVerdict,
  SiblingVerificationResult,
  type UnitRefinementPlan,
} from "@deep-spec/design-domain";
import type { SiblingBackendClient } from "@deep-spec/design-usecase";
import { ErrorMessage } from "@deep-spec/kernel-domain";
import type { Json } from "@deep-spec/kernel-infrastructure";
import { renderLoweredDocument } from "./lowered-document-serializer.ts";
import { reachabilityVariant } from "./reachability-variant.ts";
import type { SiblingBackendClientConfiguration } from "./sibling-backend-client-configuration.ts";
import { parseSiblingVerdictDocument } from "./sibling-document-parser.ts";

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
    const document = run.doc === null ? null : parseSiblingVerdictDocument(run.doc);
    const refinementFailure = ErrorMessage.of(`refinement pass could not run (${run.note.slice(0, 120)})`);
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
    return this.runLowered("quint", plan.unit(), plan.loweredForQuint(), wallTimeoutMs);
  }

  probeState(probe: ReachabilityProbe, wallTimeoutMs: number): ReachabilityVerdict {
    const variant = reachabilityVariant(
      renderLoweredDocument(probe.unit(), probe.lowered()),
      probe.attributePath(),
      probe.state(),
    );
    const run = this.#spawn("quint", variant, wallTimeoutMs);
    if (run.exit !== 0 || run.doc === null) return ReachabilityVerdict.unverified();
    return parseSiblingVerdictDocument(run.doc).reachabilityOf(probe.attributePath(), probe.state());
  }

  #spawn(
    backend: "smt" | "quint",
    loweredDoc: Json,
    wallTimeoutMs: number,
  ): { exit: number | null; doc: Json | null; note: string } {
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
      let doc: Json | null = null;
      try {
        doc = JSON.parse(readFileSync(findingsPath, "utf-8")) as Json;
      } catch {
        doc = null;
      }
      const note = res.error ? String(res.error) : ((res.stdout ?? "").trim().split("\n").pop() ?? "");
      return { exit: res.status, doc, note };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
}
