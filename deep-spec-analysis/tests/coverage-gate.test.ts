import { describe, expect, test } from "bun:test";
import {
  ABSOLUTE_THRESHOLD,
  TOLERANCE,
  failedTestCount,
  geWithTolerance,
  parseArgs,
  parseLcovLinePercent,
  runGate,
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
    expect(gate(ABSOLUTE_THRESHOLD).report).toEqual({ exitCode: 0, headPercent: ABSOLUTE_THRESHOLD, basePercent: null });
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
