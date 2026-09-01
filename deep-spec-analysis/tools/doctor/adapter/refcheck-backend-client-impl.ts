import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RefcheckBackendClient } from "../usecase/index.ts";
import type { RefcheckBackendClientConfig } from "./refcheck-backend-client-config.ts";

// refcheck report-only 実行の実 Gateway——spawn 維持（故障隔離・15s timeout
// 意味論の保存、移行 PR9/#22）。旧 refcheckReportOnly からの逐語移植:
// ツール欠如・error・非 0 exit・壊れた verdict はすべて null（不算入）。
export class RefcheckBackendClientImpl implements RefcheckBackendClient {
  readonly #root: string;

  constructor(config: RefcheckBackendClientConfig) {
    this.#root = config.root;
  }

  reportOnlyFindings(tool: string, artifactPath: string): number | null {
    const script = join(this.#root, "tools", tool);
    if (!existsSync(script)) return null;
    const res = spawnSync("bun", [script, "--stage", "doctor", "--output-path", artifactPath, "--report-only"], {
      encoding: "utf-8",
      timeout: 15_000,
    });
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
