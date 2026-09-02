// QuintClient の実 Gateway 実装。quint CLI の probe・method 検出（java ＋
// Apalache 配布物）・機械コンパイル・一時ディレクトリでの CLI 実行・ITF
// decode を持ち、型付き判定だけを返す。quintBin・method 上書き・
// APALACHE_DIST の有無・HOME は entry が環境から注入する（process.* は
// entry 限定のため）。seed・ステップ/サンプル予算・タイムアウトは決定論の
// 一部として凍結。旧 main の CLI 編成部からの逐語移植。

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QuintMachineRunVerdict, QuintRuns, QuintScenarioVerdict, QuintTemporalVerdict, TraceStates, VerificationSkips } from "../domain/index.ts";
import type {
  RequirementsModel,
} from "../domain/index.ts";
import type { QuintCheckResult, QuintClient } from "../usecase/index.ts";
import { decodeItfTrace, itfStatus } from "./itf-decoder.ts";
import { type CompiledQuintMachine } from "./compiled-quint-machine.ts";
import { compileQuintMachine } from "./quint-compilation.ts";
import type { QuintClientConfig } from "./quint-client-config.ts";

const SEED = "0x2a";
const MAX_STEPS = 8;
const MAX_SAMPLES = 200;
const RUN_TIMEOUT_MS = 30_000;
const VERIFY_TIMEOUT_MS = 45_000;
const SCENARIO_TIMEOUT_MS = 15_000;


interface QuintRun {
  timedOut: boolean;
  stdout: string;
  stderr: string;
  itf: string | null;
}

export class QuintClientImpl implements QuintClient {
  readonly #config: QuintClientConfig;

  constructor(config: QuintClientConfig) {
    this.#config = config;
  }

  check(model: RequirementsModel): QuintCheckResult {
    const probe = spawnSync(this.#config.quintBin, ["--version"], { encoding: "utf-8", timeout: 15_000 });
    if (probe.error || probe.status !== 0) {
      return { kind: "cli-unavailable" };
    }
    const bounded = this.#detectBoundedMode();
    const method = bounded ? "bounded" : "simulation";
    const compiled = compileQuintMachine(model);
    if (compiled.kind === "uncompilable") {
      return { kind: "machine-uncompilable", method, error: compiled.error };
    }
    const machine = compiled.machine;

    const work = mkdtempSync(join(tmpdir(), "deep-spec-quint-"));
    const modulePath = join(work, "main.qnt");
    writeFileSync(modulePath, machine.moduleText, "utf-8");
    try {
      const machineRun = this.#runMachinePhase(machine, modulePath, bounded, work);
      // phase 2 の「既に skip 済みの義務は走らせない」凍結ガード：コンパイル時
      // skip と、機械フェーズの判定が命じる対象一括 skip（timeout / run-failed）。
      const skipTargets = new Set(machine.compileSkips.map((s) => s.target().asString()));
      if (machineRun !== null && machineRun.abortsMachineTargets()) {
        for (const t of machine.facts.machineTargets()) {
          skipTargets.add(t.asString());
        }
      }
      const temporals = bounded ? this.#runTemporalPhase(machine, modulePath, skipTargets, work) : new Map<string, QuintTemporalVerdict>();
      const scenarios = this.#runScenarioPhase(machine, modulePath, work);
      const runs = QuintRuns.of({ machine: machineRun, temporals, scenarios });
      return { kind: "checked", method, facts: machine.facts, compileSkips: VerificationSkips.of(machine.compileSkips), runs };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }

  #detectBoundedMode(): boolean {
    const override = this.#config.methodOverride;
    if (override === "bounded") return true;
    if (override === "simulation") return false;
    const java = spawnSync("java", ["-version"], { encoding: "utf-8", timeout: 10_000 });
    if (java.error || java.status !== 0) return false;
    if (this.#config.apalacheDistSet) return true;
    try {
      return readdirSync(join(this.#config.homeDirectory, ".quint")).some((f) => f.startsWith("apalache-dist-"));
    } catch {
      return false;
    }
  }

  #runQuint(args: string[], itfPath: string | null, timeoutMs: number, cwd: string): QuintRun {
    const res = spawnSync(this.#config.quintBin, args, { encoding: "utf-8", timeout: timeoutMs, cwd });
    const timedOut = res.signal === "SIGTERM" || res.signal === "SIGKILL";
    let itf: string | null = null;
    if (itfPath && existsSync(itfPath)) {
      try {
        itf = readFileSync(itfPath, "utf-8");
      } catch {
        itf = null;
      }
    }
    return { timedOut, stdout: res.stdout ?? "", stderr: res.stderr ?? "", itf };
  }

  #outputTail(run: QuintRun): string {
    return `${run.stderr}${run.stdout}`.trim().split("\n").pop()?.slice(0, 200) ?? "";
  }

  // 1) イベント機械下の到達可能な不変量違反・デッドロック。
  #runMachinePhase(
    machine: CompiledQuintMachine,
    modulePath: string,
    bounded: boolean,
    work: string,
  ): QuintMachineRunVerdict | null {
    if (!machine.facts.hasInvariantComponents()) return null;
    const itfPath = join(work, "machine.itf.json");
    const run = bounded
      ? this.#runQuint(
          ["verify", modulePath, "--main=main", "--invariant=invAll", `--max-steps=${MAX_STEPS}`, `--out-itf=${itfPath}`],
          itfPath,
          VERIFY_TIMEOUT_MS,
          work,
        )
      : this.#runQuint(
          [
            "run",
            modulePath,
            "--main=main",
            "--invariant=invAll",
            `--seed=${SEED}`,
            `--max-samples=${MAX_SAMPLES}`,
            `--max-steps=${MAX_STEPS}`,
            `--out-itf=${itfPath}`,
          ],
          itfPath,
          RUN_TIMEOUT_MS,
          work,
        );
    if (run.timedOut) return QuintMachineRunVerdict.timeout();
    if (`${run.stdout}\n${run.stderr}`.toLowerCase().includes("deadlock")) {
      return QuintMachineRunVerdict.deadlock(run.itf ? TraceStates.of(decodeItfTrace(run.itf, machine.varToPath)) : null);
    }
    const violated = run.itf !== null && (itfStatus(run.itf) === "violation" || (bounded && !!run.itf));
    if (violated && run.itf) {
      return QuintMachineRunVerdict.violation(TraceStates.of(decodeItfTrace(run.itf, machine.varToPath)));
    }
    if (!violated && run.itf === null && `${run.stdout}${run.stderr}`.includes("error")) {
      return QuintMachineRunVerdict.runFailed(this.#outputTail(run));
    }
    return QuintMachineRunVerdict.clean();
  }

  // 2) leads-to 時相義務（bounded のみ）。モジュールに emit された時相定義
  // だけを実行する。
  #runTemporalPhase(
    machine: CompiledQuintMachine,
    modulePath: string,
    skipTargets: ReadonlySet<string>,
    work: string,
  ): Map<string, QuintTemporalVerdict> {
    const out = new Map<string, QuintTemporalVerdict>();
    for (const [obId, temporalName] of machine.temporalNames) {
      if (skipTargets.has(obId)) continue;
      const itfPath = join(work, `${temporalName}.itf.json`);
      const run = this.#runQuint(
        ["verify", modulePath, "--main=main", `--temporal=${temporalName}`, `--max-steps=${MAX_STEPS}`, `--out-itf=${itfPath}`],
        itfPath,
        VERIFY_TIMEOUT_MS,
        work,
      );
      if (run.timedOut) {
        out.set(obId, QuintTemporalVerdict.timeout());
      } else if (run.itf) {
        out.set(obId, QuintTemporalVerdict.violation(TraceStates.of(decodeItfTrace(run.itf, machine.varToPath))));
      } else {
        out.set(obId, QuintTemporalVerdict.clean());
      }
    }
    return out;
  }

  // 3) シナリオ検査（全属性束縛・イベントなし）：クロスチェック面。
  #runScenarioPhase(
    machine: CompiledQuintMachine,
    modulePath: string,
    work: string,
  ): Map<string, QuintScenarioVerdict> {
    const out = new Map<string, QuintScenarioVerdict>();
    for (const [scId, initAction] of machine.scenarioInitActions) {
      const itfPath = join(work, `${initAction.replace(/^scInit/, "sc")}.itf.json`);
      const run = this.#runQuint(
        [
          "run",
          modulePath,
          "--main=main",
          `--init=${initAction}`,
          "--step=idle",
          "--invariant=invAll",
          "--max-steps=1",
          "--max-samples=1",
          `--seed=${SEED}`,
          `--out-itf=${itfPath}`,
        ],
        itfPath,
        SCENARIO_TIMEOUT_MS,
        work,
      );
      if (run.timedOut) {
        out.set(scId, QuintScenarioVerdict.timeout());
      } else if (!run.itf && `${run.stdout}${run.stderr}`.includes("error")) {
        out.set(scId, QuintScenarioVerdict.runFailed(this.#outputTail(run)));
      } else {
        out.set(scId, QuintScenarioVerdict.evaluated(run.itf !== null && itfStatus(run.itf) === "violation"));
      }
    }
    return out;
  }
}
