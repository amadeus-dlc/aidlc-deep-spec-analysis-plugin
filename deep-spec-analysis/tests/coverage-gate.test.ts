import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ABSOLUTE_THRESHOLD,
  failedTestCount,
  geWithTolerance,
  parseArgs,
  parseLcovLinePercent,
  pinCoverageConfig,
  runGate,
  TOLERANCE,
} from "../scripts/coverage";

const LCOV = [
  "TN:",
  "SF:src/kernel/domain/a.ts",
  "FNF:2",
  "FNH:2",
  "LF:10",
  "LH:9",
  "end_of_record",
  "SF:src/design/domain/b.ts",
  "LF:30",
  "LH:30",
  "end_of_record",
  "",
].join("\n");

describe("coverage gate — lcov parsing", () => {
  test("sums LF/LH across every record into one line percentage", () => {
    expect(parseLcovLinePercent(LCOV)).toBeCloseTo(97.5, 10);
  });

  test("an lcov without records yields null, and zero measurable lines count as full coverage", () => {
    expect(parseLcovLinePercent("")).toBeNull();
    expect(parseLcovLinePercent("SF:x.ts\nLF:0\nLH:0\nend_of_record\n")).toBe(100);
  });

  test("reads the failed-test count from bun's summary line only", () => {
    expect(failedTestCount(" 577 pass\n 1 skip\n 0 fail\n")).toBe(0);
    expect(failedTestCount("some text\n 3 fail\n")).toBe(3);
    expect(failedTestCount("no summary here")).toBe(0);
  });

  test("geWithTolerance treats equality and the tolerance band as a pass", () => {
    expect(geWithTolerance(90, 90, 0)).toBe(true);
    expect(geWithTolerance(89.995, 90, TOLERANCE)).toBe(true);
    expect(geWithTolerance(89.98, 90, TOLERANCE)).toBe(false);
  });
});

describe("coverage gate — decisions", () => {
  function gate(head: number, base?: number) {
    const log: string[] = [];
    const removed: string[] = [];
    const report = runGate({
      baseRef: base === undefined ? undefined : "origin/main",
      repoRoot: "/repo",
      measure: (root) => (root === "/repo" ? head : (base as number)),
      checkoutBase: () => "/tmp/base-worktree",
      removeWorktree: (_root, dir) => {
        removed.push(dir);
      },
      log: (line) => log.push(line),
    });
    return { report, log, removed };
  }

  test("absolute gate alone passes at the threshold and fails below it", () => {
    expect(gate(ABSOLUTE_THRESHOLD).report).toEqual({
      exitCode: 0,
      headPercent: ABSOLUTE_THRESHOLD,
      basePercent: null,
    });
    const failing = gate(ABSOLUTE_THRESHOLD - 0.01);
    expect(failing.report.exitCode).toBe(1);
    expect(failing.log.some((line) => line.startsWith("[FAIL] absolute gate"))).toBe(true);
  });

  test("relative gate passes when head matches, exceeds, or sits within tolerance of base", () => {
    expect(gate(95, 95).report.exitCode).toBe(0);
    expect(gate(96, 95).report.exitCode).toBe(0);
    expect(gate(95 - TOLERANCE / 2, 95).report.exitCode).toBe(0);
  });

  test("relative gate fails when head drops below base by more than the tolerance, and the worktree is always removed", () => {
    const dropped = gate(94.9, 95);
    expect(dropped.report).toEqual({ exitCode: 1, headPercent: 94.9, basePercent: 95 });
    expect(dropped.log.some((line) => line.startsWith("[FAIL] relative gate"))).toBe(true);
    expect(dropped.removed).toEqual(["/tmp/base-worktree"]);
  });

  test("the worktree is removed even when the base measurement throws", () => {
    const removed: string[] = [];
    expect(() =>
      runGate({
        baseRef: "origin/main",
        repoRoot: "/repo",
        measure: (root) => {
          if (root === "/repo") return 95;
          throw new Error("base tests failed");
        },
        checkoutBase: () => "/tmp/base-worktree",
        removeWorktree: (_root, dir) => {
          removed.push(dir);
        },
        log: () => {},
      }),
    ).toThrow("base tests failed");
    expect(removed).toEqual(["/tmp/base-worktree"]);
  });

  test("parseArgs accepts --base <ref> and --help, and rejects anything else", () => {
    expect(parseArgs([])).toEqual({ baseRef: undefined, help: false });
    expect(parseArgs(["--base", "origin/main"])).toEqual({ baseRef: "origin/main", help: false });
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(() => parseArgs(["--base"])).toThrow("--base には git-ref");
    expect(() => parseArgs(["--nope"])).toThrow("未知の引数");
  });
});

describe("coverage gate — one coverage config for head and base", () => {
  const sandboxes: string[] = [];

  afterEach(() => {
    for (const dir of sandboxes.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function pair(
    headConfig: string,
    baseConfig: string | null,
  ): { repoRoot: string; worktree: string; basePath: string } {
    const repoRoot = mkdtempSync(join(tmpdir(), "deep-spec-pin-head-"));
    const worktree = mkdtempSync(join(tmpdir(), "deep-spec-pin-base-"));
    sandboxes.push(repoRoot, worktree);
    mkdirSync(join(repoRoot, "deep-spec-analysis"), { recursive: true });
    writeFileSync(join(repoRoot, "deep-spec-analysis", "bunfig.toml"), headConfig);
    mkdirSync(join(worktree, "deep-spec-analysis"), { recursive: true });
    const basePath = join(worktree, "deep-spec-analysis", "bunfig.toml");
    if (baseConfig !== null) writeFileSync(basePath, baseConfig);
    return { repoRoot, worktree, basePath };
  }

  test("head's bunfig replaces the base worktree's, so both sides share one denominator", () => {
    const head = '[test]\ncoverageThreshold = 0.9\ncoveragePathIgnorePatterns = ["tests/**"]\n';
    const { repoRoot, worktree, basePath } = pair(head, '[test]\ncoveragePathIgnorePatterns = ["src/**"]\n');
    pinCoverageConfig(repoRoot, worktree);
    expect(readFileSync(basePath, "utf-8")).toBe(head);
  });

  test("a base worktree without its own bunfig still receives head's", () => {
    const head = "[test]\ncoverageThreshold = 0.9\n";
    const { repoRoot, worktree, basePath } = pair(head, null);
    pinCoverageConfig(repoRoot, worktree);
    expect(readFileSync(basePath, "utf-8")).toBe(head);
  });

  test("a missing head bunfig or an unrecognisable worktree is an error, never a silent skip", () => {
    const missingHead = mkdtempSync(join(tmpdir(), "deep-spec-pin-nohead-"));
    const worktree = mkdtempSync(join(tmpdir(), "deep-spec-pin-base-"));
    sandboxes.push(missingHead, worktree);
    mkdirSync(join(worktree, "deep-spec-analysis"), { recursive: true });
    expect(() => pinCoverageConfig(missingHead, worktree)).toThrow("head の bunfig.toml が見つかりません");

    const { repoRoot } = pair("[test]\n", null);
    const emptyWorktree = mkdtempSync(join(tmpdir(), "deep-spec-pin-empty-"));
    sandboxes.push(emptyWorktree);
    expect(() => pinCoverageConfig(repoRoot, emptyWorktree)).toThrow(
      "base worktree に deep-spec-analysis/ がありません",
    );
  });
});
