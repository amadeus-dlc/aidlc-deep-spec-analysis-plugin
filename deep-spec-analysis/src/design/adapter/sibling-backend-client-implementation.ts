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
import { type LoweredUnit, ReachabilityVerdict } from "@deep-spec/design-domain";
import type { SiblingBackendClient, SiblingLoweredRun } from "@deep-spec/design-usecase";
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
  ): SiblingLoweredRun {
    const run = this.#spawn(backend, renderLoweredDocument(unit, lowered), wallTimeoutMs);
    return {
      exit: run.exit,
      doc: run.doc === null ? null : parseSiblingVerdictDocument(run.doc),
      note: run.note,
    };
  }

  probeState(
    unit: DesignUnit,
    lowered: LoweredUnit,
    attrPath: string,
    state: string,
    wallTimeoutMs: number,
  ): ReachabilityVerdict {
    const variant = reachabilityVariant(renderLoweredDocument(unit, lowered), attrPath, state);
    const run = this.#spawn("quint", variant, wallTimeoutMs);
    if (run.exit !== 0 || run.doc === null) {
      return ReachabilityVerdict.unverified();
    }
    return parseSiblingVerdictDocument(run.doc).reachabilityOf(attrPath, state);
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
