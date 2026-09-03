import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SolverAvailability } from "../domain/index.ts";
import type { SolverProbeClient } from "../usecase/index.ts";
import type { SolverProbeClientConfig } from "./solver-probe-client-config.ts";

// 127.0.0.1:<port> に繋がるかだけを答える子スクリプト（exit 0 = 待ち受けあり）。
// availability() は同期のままにしたいので、非同期 socket を子プロセスに閉じ込める。
// bun と node のどちらで評価しても同じに動く（`-e` ＋ require("node:net")）。
// 繋がれば socket を閉じて自然に終わり（0）、繋がらなければ投げて非ゼロで終わる。
function listenProbe(port: number): string {
  return (
    `const s=require("node:net").connect(${port},"127.0.0.1");` +
    "s.setTimeout(300);" +
    's.on("connect",()=>{s.destroy()});' +
    's.on("timeout",()=>{s.destroy();throw new Error("no apalache server")});' +
    's.on("error",()=>{throw new Error("no apalache server")});'
  );
}

// 最小の検査可能な仕様。孤児サーバなら作業ディレクトリを掴めず必ず落ちる。
const PROBE_MODULE = `module probe {
  var x: int
  action init = { x' = 0 }
  action step = { x' = x + 1 }
  val inv = x >= 0
}
`;

// ソルバ環境プローブの実 Gateway。旧 doctor の probe/存在検査からの逐語移植:
// --version 打診は 5s timeout、z3 は WASM パッケージの実在（z3 の pthread
// ビルドは bun 内では abort するため node 子プロセスが実行面）、Apalache は
// JDK と ~/.quint 配布物（または APALACHE_DIST 宣言）の両立。
// Apalache だけは静的検査で足りない（issue #128）: 配布物も JDK も在るのに、
// 8822 番の孤児サーバが消えた cwd を掴んでいると verify は全部落ちる。
// 待ち受けが在るときだけ trivial spec を 1 本 verify して、その陳腐化を測る。
export class SolverProbeClientImpl implements SolverProbeClient {
  readonly #config: SolverProbeClientConfig;

  constructor(config: SolverProbeClientConfig) {
    this.#config = config;
  }

  #probe(cmd: string, args: string[]): boolean {
    const res = spawnSync(cmd, args, { encoding: "utf-8", timeout: 5000 });
    return !res.error && res.status === 0;
  }

  // 待ち受けが無ければプローブは払わない——doctor に JVM 起動コストを持ち込まない。
  #apalacheServerIsListening(): boolean {
    const res = spawnSync(this.#config.runtimeBin, ["-e", listenProbe(this.#config.apalachePort)], {
      encoding: "utf-8",
      timeout: 2_000,
    });
    return !res.error && res.status === 0;
  }

  // 待ち受け中のサーバで trivial spec を 1 本検査する。exit 0 でなければ陳腐化。
  // タイムアウト時の killSignal が SIGINT なのは QuintClientImpl と同じ理由
  // （quint の後始末ハンドラは SIGTERM に付かない）。
  #apalacheServerIsStale(): boolean {
    if (!this.#apalacheServerIsListening()) return false;
    const work = mkdtempSync(join(tmpdir(), "deep-spec-doctor-probe-"));
    try {
      const spec = join(work, "probe.qnt");
      writeFileSync(spec, PROBE_MODULE, "utf-8");
      const res = spawnSync(this.#config.quintBin, ["verify", spec, "--main=probe", "--invariant=inv", "--max-steps=1"], {
        encoding: "utf-8",
        timeout: 30_000,
        cwd: work,
        killSignal: "SIGINT",
      });
      return Boolean(res.error) || res.status !== 0;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
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
    const quintCli = this.#probe(this.#config.quintBin, ["--version"]);
    const apalache = this.#probe("java", ["-version"]) && apalacheDist;
    return SolverAvailability.of({
      z3Package: existsSync(join(this.#config.projectDir, "node_modules", "z3-solver", "package.json")),
      nodeRuntime: this.#probe("node", ["--version"]),
      quintCli,
      apalache,
      // quint が無ければ verify そのものが打てない——陳腐化は測れないので測らない。
      apalacheServerStale: apalache && quintCli && this.#apalacheServerIsStale(),
    });
  }
}
