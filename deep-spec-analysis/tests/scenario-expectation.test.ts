import { expect, test } from "bun:test";
import { ScenarioExpectation } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

test("accept and reject expectations own the satisfiability truth table", () => {
  for (const [kind, satisfiable, violated] of [
    ["accept", true, false],
    ["accept", false, true],
    ["reject", true, true],
    ["reject", false, false],
  ] as const) {
    const expectation = ScenarioExpectation.of(kind);
    expect(expectation.isViolatedBySatisfiability(satisfiable)).toBe(violated);
    expect(expectation.asString()).toBe(kind);
    expect(ScenarioExpectation.parse(kind).ok).toBe(true);
  }
});

test("invalid scenario expectations fail by panic or a non-exception parse error", () => {
  for (const value of ["", "ACCEPT", "accept\n", "x".repeat(7)]) {
    expect(() => ScenarioExpectation.of(value)).toThrow(IllegalArgumentException);
    const parsed = ScenarioExpectation.parse(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error instanceof Error).toBe(false);
  }
});
