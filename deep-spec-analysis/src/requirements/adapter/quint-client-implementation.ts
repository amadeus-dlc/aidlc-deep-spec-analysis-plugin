// QuintClient の実 Gateway 実装。quint CLI の probe・method 検出（java ＋
// Apalache 配布物）・機械コンパイル・一時ディレクトリでの CLI 実行・ITF
// decode を持ち、型付き判定だけを返す。quintBin・method 上書き・
// APALACHE_DIST の有無・HOME は entry が環境から注入する（process.* は
// entry 限定のため）。seed・ステップ/サンプル予算・タイムアウトは決定論の
// 一部として凍結（config の timeoutOverrideMs だけがテスト用の注入口）。
// 旧 main の CLI 編成部からの逐語移植。

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readArtifactText, readDirectory } from "@deep-spec-analysis/kernel-adapter";
import { ErrorMessage, KeyedIndex, VerificationMethod } from "@deep-spec-analysis/kernel-domain";
import { err, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { RequirementsModel } from "@deep-spec-analysis/requirements-domain";
import {
  ObligationIdentifier,
  QuintCheckResult,
  QuintMachineRunVerdict,
  QuintRuns,
  QuintScenarioVerdict,
  QuintTemporalVerdict,
  ScenarioIdentifier,
  VerificationSkips,
} from "@deep-spec-analysis/requirements-domain";
import type { QuintClient } from "@deep-spec-analysis/requirements-usecase";
import type { CompiledQuintMachine } from "./compiled-quint-machine.ts";
import { decodeItfTrace, itfStatus } from "./itf-decoder.ts";
import type { QuintClientConfiguration } from "./quint-client-configuration.ts";
import { compileQuintMachine } from "./quint-compilation.ts";
import { hasQuintDeadlockDiagnostic } from "./quint-process-diagnostics.ts";

const SEED = "0x2a";
const MAX_STEPS = 8;
const MAX_SAMPLES = 200;
const RUN_TIMEOUT_MS = 30_000;
const VERIFY_TIMEOUT_MS = 45_000;
const SCENARIO_TIMEOUT_MS = 15_000;

function errorMessageOrFallback(raw: string, fallback: string): ErrorMessage {
  const parsed = ErrorMessage.parse(raw);
  return parsed.ok ? parsed.value : ErrorMessage.of(fallback);
}

interface QuintRun {
  timedOut: boolean;
  // 予算内で「答えられなかった」証拠: spawn そのものの失敗（ETIMEDOUT 以外の
  // res.error——CI 負荷下の EAGAIN 等）、非ゼロ終了、予算外のシグナル死。違反時も
  // quint は非ゼロで終わるので、各フェーズはITFの有無を先に見て反例を復号し、
  // ITFが無いときだけこの事実を使う。boundedの正常cleanはITFを書かないことがある。
  failed: boolean;
  stdout: string;
  stderr: string;
  itf: string | null;
  itfError: string | null;
}

export class QuintClientImplementation implements QuintClient {
  readonly #config: QuintClientConfiguration;

  constructor(config: QuintClientConfiguration) {
    this.#config = config;
  }

  check(model: RequirementsModel): QuintCheckResult {
    const probe = spawnSync(this.#config.quintBin, ["--version"], { encoding: "utf-8", timeout: 15_000 });
    if (probe.error || probe.status !== 0) {
      return QuintCheckResult.of({ kind: "cli-unavailable" });
    }
    const bounded = this.#detectBoundedMode();
    if (!bounded.ok)
      return QuintCheckResult.of({
        kind: "backend-unavailable",
        reason: errorMessageOrFallback(
          `could not inspect Quint Apalache distribution: ${this.#repositoryErrorDetail(bounded.error)}`,
          "could not inspect Quint Apalache distribution",
        ),
      });
    const method = bounded.value ? "bounded" : "simulation";
    const compiled = compileQuintMachine(model);
    if (compiled.kind === "uncompilable") {
      return QuintCheckResult.of({
        kind: "machine-uncompilable",
        method: VerificationMethod.of(method),
        error: errorMessageOrFallback(compiled.error, "Quint machine could not be compiled"),
      });
    }
    const machine = compiled.machine;

    const work = mkdtempSync(join(tmpdir(), "deep-spec-quint-"));
    const modulePath = join(work, "main.qnt");
    writeFileSync(modulePath, machine.moduleText, "utf-8");
    try {
      const machineRun = this.#runMachinePhase(machine, modulePath, bounded.value, work);
      // phase 2 の「既に skip 済みの義務は走らせない」凍結ガード：コンパイル時
      // skip と、機械フェーズの判定が命じる対象一括 skip（timeout / run-failed）。
      const skipTargets = new Set(machine.compileSkips.map((s) => s.target().asString()));
      if (machineRun?.abortsMachineTargets()) {
        for (const t of machine.plan.machineTargets()) {
          skipTargets.add(t.asString());
        }
      }
      const temporals = bounded.value
        ? this.#runTemporalPhase(machine, modulePath, skipTargets, work)
        : new Map<string, QuintTemporalVerdict>();
      const scenarios = this.#runScenarioPhase(machine, modulePath, work);
      const runs = QuintRuns.of({
        machine: machineRun,
        temporals: KeyedIndex.of([...temporals].map(([id, v]) => [ObligationIdentifier.of(id), v] as const)),
        scenarios: KeyedIndex.of([...scenarios].map(([id, v]) => [ScenarioIdentifier.of(id), v] as const)),
      });
      return QuintCheckResult.of({
        kind: "checked",
        method: VerificationMethod.of(method),
        plan: machine.plan,
        compileSkips: VerificationSkips.of(machine.compileSkips),
        runs,
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }

  #detectBoundedMode(): Result<boolean, RepositoryError> {
    const override = this.#config.methodOverride;
    if (override === "bounded") return ok(true);
    if (override === "simulation") return ok(false);
    const java = spawnSync("java", ["-version"], { encoding: "utf-8", timeout: 10_000 });
    if (java.error || java.status !== 0) return ok(false);
    if (this.#config.apalacheDistSet) return ok(true);
    const quintDirectory = readDirectory(join(this.#config.homeDirectory, ".quint"));
    if (!quintDirectory.ok) return quintDirectory.error.kind === "not-found" ? ok(false) : err(quintDirectory.error);
    return ok(quintDirectory.value.some((entry) => entry.isDirectory() && entry.name.startsWith("apalache-dist-")));
  }

  // 予算超過は SIGINT で止める（spawnSync の既定 SIGTERM ではない）。quint 0.32 は
  // Apalache サーバを spawn したとき、その後始末ハンドラを exit / SIGINT /
  // SIGUSR1 / SIGUSR2 / uncaughtException にだけ登録する——SIGTERM には付かない。
  // SIGTERM で殺すとサーバは孤児として生き残り、しかもその cwd は下の一時
  // ディレクトリなので check() の後片付けで消える。以後の `quint verify` は
  // すべてその孤児に接続して `<消えた cwd>/_apalache-out/server/…/log2.smt
  // (No such file or directory)` で落ちる（実測、issue #128）。SIGINT なら
  // quint 自身の後始末が走り、サーバごと終わる。
  // タイムアウト判定は res.error.code === "ETIMEDOUT" だけを証拠にする。
  // 子プロセス自身の SIGTERM / SIGKILL は status が0でない事実から failed へ送る。
  #runQuint(args: string[], itfPath: string | null, timeoutMs: number, cwd: string): QuintRun {
    const budget = this.#config.timeoutOverrideMs ?? timeoutMs;
    const res = spawnSync(this.#config.quintBin, args, {
      encoding: "utf-8",
      timeout: budget,
      cwd,
      killSignal: "SIGINT",
    });
    const errorCode = (res.error as { code?: unknown } | undefined)?.code;
    const timedOut = errorCode === "ETIMEDOUT";
    // status は正常終了でだけ数値になる。シグナル死（SIGSEGV 等）は null なので
    // 「0 でない」に含まれる。
    const failed = !timedOut && (res.error !== undefined || res.status !== 0);
    let itf: string | null = null;
    let itfError: string | null = null;
    if (itfPath) {
      const read = readArtifactText(itfPath);
      if (read.ok) itf = read.value;
      else if (read.error.kind !== "not-found") itfError = this.#repositoryErrorDetail(read.error);
    }
    return { timedOut, failed, stdout: res.stdout ?? "", stderr: res.stderr ?? "", itf, itfError };
  }

  #repositoryErrorDetail(error: RepositoryError): string {
    return "cause" in error ? `${error.kind}: ${error.cause}` : error.kind;
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
    // 不変量義務が無くても走らせる（裁定 4、2026-09-03）: コンパイラは背景制約と
    // 型境界を invAll に畳んでいるので、イベントがそれを破る到達可能状態はこの
    // フェーズでしか捕まらない（CLI が告げるデッドロックも同様）。
    const itfPath = join(work, "machine.itf.json");
    const run = bounded
      ? this.#runQuint(
          [
            "verify",
            modulePath,
            "--main=main",
            "--invariant=invAll",
            `--max-steps=${MAX_STEPS}`,
            `--out-itf=${itfPath}`,
          ],
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
    if (run.itfError !== null) return QuintMachineRunVerdict.runFailed(`quint ITF read failed: ${run.itfError}`);
    if (run.failed && hasQuintDeadlockDiagnostic(run.stderr)) {
      if (!run.itf) return QuintMachineRunVerdict.deadlock(null);
      const trace = decodeItfTrace(run.itf, machine.varToPath);
      return trace.ok ? QuintMachineRunVerdict.deadlock(trace.value) : QuintMachineRunVerdict.runFailed(trace.error);
    }
    const violated = run.itf !== null && (itfStatus(run.itf) === "violation" || (bounded && !!run.itf));
    if (violated && run.itf) {
      const trace = decodeItfTrace(run.itf, machine.varToPath);
      return trace.ok ? QuintMachineRunVerdict.violation(trace.value) : QuintMachineRunVerdict.runFailed(trace.error);
    }
    if (!violated && run.itf === null && run.failed) {
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
        [
          "verify",
          modulePath,
          "--main=main",
          `--temporal=${temporalName}`,
          `--max-steps=${MAX_STEPS}`,
          `--out-itf=${itfPath}`,
        ],
        itfPath,
        VERIFY_TIMEOUT_MS,
        work,
      );
      if (run.timedOut) {
        out.set(obId, QuintTemporalVerdict.timeout());
      } else if (run.itfError !== null) {
        out.set(obId, QuintTemporalVerdict.runFailed(`quint ITF read failed: ${run.itfError}`));
      } else if (run.itf) {
        const trace = decodeItfTrace(run.itf, machine.varToPath);
        out.set(
          obId,
          trace.ok ? QuintTemporalVerdict.violation(trace.value) : QuintTemporalVerdict.runFailed(trace.error),
        );
      } else if (run.failed) {
        // verify は違反時にだけ ITF を書くので、ITF 無しは clean か失敗かの二択。
        // プロセスの事実で見分ける——以前は無条件に clean だった。
        out.set(obId, QuintTemporalVerdict.runFailed(this.#outputTail(run)));
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
      } else if (run.itfError !== null) {
        out.set(scId, QuintScenarioVerdict.runFailed(`quint ITF read failed: ${run.itfError}`));
      } else if (!run.itf && run.failed) {
        out.set(scId, QuintScenarioVerdict.runFailed(this.#outputTail(run)));
      } else {
        out.set(scId, QuintScenarioVerdict.evaluated(run.itf !== null && itfStatus(run.itf) === "violation"));
      }
    }
    return out;
  }
}
