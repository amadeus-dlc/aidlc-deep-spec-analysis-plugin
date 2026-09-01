import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SolverAvailability } from "../domain/index.ts";
import type { SolverProbeClient } from "../usecase/index.ts";
import type { SolverProbeClientConfig } from "./solver-probe-client-config.ts";

// ソルバ環境プローブの実 Gateway。旧 doctor の probe/存在検査からの逐語移植:
// --version 打診は 5s timeout、z3 は WASM パッケージの実在（z3 の pthread
// ビルドは bun 内では abort するため node 子プロセスが実行面）、Apalache は
// JDK と ~/.quint 配布物（または APALACHE_DIST 宣言）の両立。
export class SolverProbeClientImpl implements SolverProbeClient {
  readonly #config: SolverProbeClientConfig;

  constructor(config: SolverProbeClientConfig) {
    this.#config = config;
  }

  #probe(cmd: string, args: string[]): boolean {
    const res = spawnSync(cmd, args, { encoding: "utf-8", timeout: 5000 });
    return !res.error && res.status === 0;
  }

  availability(): SolverAvailability {
    let apalacheDist = this.#config.apalacheDistDeclared;
    if (!apalacheDist) {
      try {
        apalacheDist = readdirSync(join(this.#config.homeDir, ".quint")).some((f) => f.startsWith("apalache-dist-"));
      } catch {
        apalacheDist = false;
      }
    }
    return {
      z3Package: existsSync(join(this.#config.projectDir, "node_modules", "z3-solver", "package.json")),
      nodeRuntime: this.#probe("node", ["--version"]),
      quintCli: this.#probe(this.#config.quintBin, ["--version"]),
      apalache: this.#probe("java", ["-version"]) && apalacheDist,
    };
  }
}
