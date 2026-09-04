#!/usr/bin/env bun
//
// scripts/coverage.ts — line coverage ゲート (bun test --coverage の lcov ベース)
//
// 参考実装: amadeus-dlc/amadeus-ng の scripts/coverage.sh (cargo-llvm-cov ベース)。
// ゲート判定 (絶対 / 相対) と worktree の扱いを踏襲し、計測だけを Bun に置き換えた。
//
// ゲート方針:
//   - 絶対ゲート: deep-spec-analysis の line coverage が ABSOLUTE_THRESHOLD (%) 以上で
//     あること。しきい値は下の定数で一元管理する (bunfig.toml の coverageThreshold 0.9
//     と同じ値)。90% 未達なら exit 1。
//   - 相対ゲート (--base <git-ref> を指定した場合のみ有効): base ref を `git worktree add`
//     で一時ディレクトリにチェックアウトし、head と同条件で計測して比較する。head が
//     base を下回ったら fail (同値・上回りは pass)。浮動小数比較の許容誤差は TOLERANCE。
//     計測後は worktree を必ず削除する (finally で保証)。
//   - 引数なし = 絶対ゲートのみ。`--base <ref>` を付けると絶対 + 相対の両方を実行する。
//
// 計測対象・除外方針:
//   - 計測対象と除外は bunfig.toml ([test] coveragePathIgnorePatterns) が正本。この
//     スクリプトは除外を持たず、`bun test --coverage --coverage-reporter=lcov` が書く
//     lcov.info の LF/LH を全ファイルで合算して line coverage % を得る。head と base は
//     それぞれ自分の bunfig.toml で計測されるので、除外条件は各 ref の内容に従う。
//
// 計測の決定化:
//   - PBT の RNG シードに相当するものは無い。quint は固定 seed で走り、ITF の #meta は
//     剥がされる (formal-verification-ops.md §3)。同一コードの再計測で差は出ない。
//
// 相対ゲートの base 計測は、worktree に submodule (aidlc-workflows) を展開し、
// `bun install --frozen-lockfile` で pinned な solver backends を入れてから行う
// (tests/intent-e2e.test.ts が dist/claude を要求するため)。

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// --- しきい値 (ここで一元管理) ----------------------------------------------
export const ABSOLUTE_THRESHOLD = 90.0;
export const TOLERANCE = 0.01;
// -----------------------------------------------------------------------------

const PACKAGE_DIR = "deep-spec-analysis";
const USAGE = `使い方: bun deep-spec-analysis/scripts/coverage.ts [オプション]

オプション:
  --base <git-ref>   相対ゲートを有効化する。指定した ref を一時 worktree に
                      チェックアウトし、head と同条件で line coverage を計測して比較する。
  --help, -h          このヘルプを表示

しきい値 (スクリプト冒頭の定数で管理):
  絶対ゲート: ABSOLUTE_THRESHOLD=${ABSOLUTE_THRESHOLD} (%) 以上で pass。
  相対ゲート: head が base を下回ったら fail (同値・上回りは pass)。許容誤差 TOLERANCE=${TOLERANCE}。
  計測除外: bunfig.toml の coveragePathIgnorePatterns に従う。

例:
  bun deep-spec-analysis/scripts/coverage.ts
  bun deep-spec-analysis/scripts/coverage.ts --base origin/main`;

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
}

export type CommandRunner = (command: string, args: readonly string[], cwd: string) => CommandResult;

export interface GateOptions {
  /** 相対ゲートの base ref。未指定なら絶対ゲートのみ。 */
  readonly baseRef?: string;
  /** リポジトリルート (deep-spec-analysis/ の親)。 */
  readonly repoRoot?: string;
  /** 指定ディレクトリ (リポジトリルート) の line coverage % を返す。 */
  readonly measure?: (repoRoot: string) => number;
  /** base ref を一時 worktree に展開して、そのルートを返す。 */
  readonly checkoutBase?: (repoRoot: string, baseRef: string) => string;
  /** 一時 worktree を片づける。measure が失敗しても必ず呼ばれる。 */
  readonly removeWorktree?: (repoRoot: string, worktreeDir: string) => void;
  readonly log?: (line: string) => void;
}

export interface GateReport {
  readonly exitCode: 0 | 1;
  readonly headPercent: number;
  readonly basePercent: number | null;
}

function defaultRunner(command: string, args: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
}

function describeFailure(result: CommandResult): string {
  if (result.error) return result.error.message;
  const tail = `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-8).join("\n");
  return `status ${result.status}${tail ? `\n${tail}` : ""}`;
}

/** lcov.info の LF (計測対象行数) と LH (実行された行数) を全レコードで合算し、
 *  line coverage % (0-100 の小数) を返す。レコードが無ければ null。 */
export function parseLcovLinePercent(lcov: string): number | null {
  let found = 0;
  let hit = 0;
  let records = 0;
  for (const raw of lcov.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:")) records += 1;
    else if (line.startsWith("LF:")) found += Number(line.slice(3));
    else if (line.startsWith("LH:")) hit += Number(line.slice(3));
  }
  if (records === 0 || !Number.isFinite(found) || !Number.isFinite(hit)) return null;
  if (found === 0) return 100;
  return (hit / found) * 100;
}

/** a >= b - tol なら true。 */
export function geWithTolerance(a: number, b: number, tol: number): boolean {
  return a >= b - tol;
}

/** `bun test --coverage` の出力から失敗したテスト数を読む (例: " 2 fail")。 */
export function failedTestCount(output: string): number {
  const match = output.match(/^\s*(\d+)\s+fail\b/m);
  return match ? Number(match[1]) : 0;
}

/** 指定リポジトリルートの deep-spec-analysis/ で bun test を走らせ、lcov から
 *  line coverage % を返す。テストの失敗と lcov の欠落は例外にする。 */
export function measureWithBun(repoRoot: string, run: CommandRunner = defaultRunner): number {
  const packageDir = join(repoRoot, PACKAGE_DIR);
  const coverageDir = mkdtempSync(join(tmpdir(), "deep-spec-coverage-"));
  try {
    const result = run(
      "bun",
      ["test", "--coverage", "--coverage-reporter=lcov", `--coverage-dir=${coverageDir}`],
      packageDir,
    );
    if (result.error) throw new Error(`bun test を起動できません (${packageDir}): ${result.error.message}`);
    const failed = failedTestCount(`${result.stdout}\n${result.stderr}`);
    if (failed > 0) throw new Error(`テストが ${failed} 件失敗しました (${packageDir})。カバレッジは判定しません`);
    const lcovPath = join(coverageDir, "lcov.info");
    if (!existsSync(lcovPath)) throw new Error(`lcov.info が書かれていません (${lcovPath}): ${describeFailure(result)}`);
    const percent = parseLcovLinePercent(readFileSync(lcovPath, "utf-8"));
    if (percent === null) throw new Error(`line coverage の取得に失敗しました (${lcovPath})`);
    return percent;
  } finally {
    rmSync(coverageDir, { recursive: true, force: true });
  }
}

function requireOk(result: CommandResult, what: string): void {
  if (result.error || result.status !== 0) throw new Error(`${what}: ${describeFailure(result)}`);
}

/** base ref を一時 worktree に展開し、submodule と依存を整えてルートを返す。 */
export function checkoutBaseWorktree(repoRoot: string, baseRef: string, run: CommandRunner = defaultRunner): string {
  const worktreeDir = mkdtempSync(join(tmpdir(), "deep-spec-coverage-base-"));
  // mktemp が作る空ディレクトリが残っていると `git worktree add` が失敗する
  rmSync(worktreeDir, { recursive: true, force: true });
  requireOk(run("git", ["worktree", "add", "--detach", worktreeDir, baseRef], repoRoot), `git worktree add (${baseRef})`);
  try {
    requireOk(run("git", ["submodule", "update", "--init", "--", "aidlc-workflows"], worktreeDir), "git submodule update (base worktree)");
    requireOk(run("bun", ["install", "--frozen-lockfile"], join(worktreeDir, PACKAGE_DIR)), "bun install (base worktree)");
  } catch (error) {
    removeWorktree(repoRoot, worktreeDir, run);
    throw error;
  }
  return worktreeDir;
}

export function removeWorktree(repoRoot: string, worktreeDir: string, run: CommandRunner = defaultRunner): void {
  const result = run("git", ["worktree", "remove", "--force", worktreeDir], repoRoot);
  if (result.error || result.status !== 0) rmSync(worktreeDir, { recursive: true, force: true });
}

function formatPercent(value: number): string {
  return value.toFixed(2);
}

/** 絶対ゲート (+ --base 指定時は相対ゲート) を評価し、結果を返す。 */
export function runGate(options: GateOptions = {}): GateReport {
  const repoRoot = resolve(options.repoRoot ?? resolve(import.meta.dir, "../.."));
  const measure = options.measure ?? measureWithBun;
  const checkoutBase = options.checkoutBase ?? checkoutBaseWorktree;
  const remove = options.removeWorktree ?? removeWorktree;
  const log = options.log ?? ((line: string) => console.log(line));

  let exitCode: 0 | 1 = 0;

  log(`==> head の line coverage を計測中 (${repoRoot})`);
  const headPercent = measure(repoRoot);
  log(`head line coverage: ${formatPercent(headPercent)}%`);

  if (geWithTolerance(headPercent, ABSOLUTE_THRESHOLD, 0)) {
    log(`[PASS] absolute gate: head (${formatPercent(headPercent)}%) >= threshold (${ABSOLUTE_THRESHOLD}%)`);
  } else {
    log(`[FAIL] absolute gate: head (${formatPercent(headPercent)}%) < threshold (${ABSOLUTE_THRESHOLD}%)`);
    exitCode = 1;
  }

  let basePercent: number | null = null;
  if (options.baseRef) {
    log(`==> base (${options.baseRef}) を一時 worktree にチェックアウト中`);
    const worktreeDir = checkoutBase(repoRoot, options.baseRef);
    try {
      log(`==> base の line coverage を計測中 (${worktreeDir})`);
      basePercent = measure(worktreeDir);
    } finally {
      remove(repoRoot, worktreeDir);
    }
    log(`base (${options.baseRef}) line coverage: ${formatPercent(basePercent)}%`);

    if (geWithTolerance(headPercent, basePercent, TOLERANCE)) {
      log(`[PASS] relative gate: head (${formatPercent(headPercent)}%) >= base (${formatPercent(basePercent)}%) - tolerance (${TOLERANCE})`);
    } else {
      log(`[FAIL] relative gate: head (${formatPercent(headPercent)}%) < base (${formatPercent(basePercent)}%) - tolerance (${TOLERANCE})`);
      exitCode = 1;
    }
  }

  return { exitCode, headPercent, basePercent };
}

export function parseArgs(args: readonly string[]): { baseRef?: string; help: boolean } {
  let baseRef: string | undefined;
  let help = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--base") {
      const value = args[i + 1];
      if (!value) throw new Error("--base には git-ref を指定してください");
      baseRef = value;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else {
      throw new Error(`未知の引数 '${arg}'\n${USAGE}`);
    }
  }
  return { baseRef, help };
}

if (import.meta.main) {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (parsed.help) {
      console.log(USAGE);
    } else {
      process.exit(runGate({ baseRef: parsed.baseRef }).exitCode);
    }
  } catch (error) {
    console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
