import { expect, test } from "bun:test";
import { AttributeCoverage, AttributePaths } from "@deep-spec-analysis/design-domain";
import { AttributePath, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

const paths = (...values: string[]) => AttributePaths.of(values.map(AttributePath.of));

test("every required attribute belongs to exactly one coverage partition", () => {
  const invalid = { required: paths("R.a"), mapped: paths("R.a"), waived: paths("R.a"), missing: paths() };
  expect(() => AttributeCoverage.of(invalid)).toThrow(IllegalArgumentException);
  expect(AttributeCoverage.parse(invalid).ok).toBe(false);
  expect(AttributeCoverage.parse({ ...invalid, mapped: paths(), waived: paths() }).ok).toBe(false);
});

test("fully covered attributes are checkable, fully waived gaps are waived, and a remaining gap wins", () => {
  const complete = AttributeCoverage.of({
    required: paths("R.a"),
    mapped: paths("R.a"),
    waived: paths(),
    missing: paths(),
  });
  expect(complete.forInvariant().isCheckable()).toBe(true);
  const waived = AttributeCoverage.of({
    required: paths("R.a", "R.b"),
    mapped: paths("R.a"),
    waived: paths("R.b"),
    missing: paths(),
  });
  expect(waived.forScenario().skipFor(TargetIdentifier.of("SC-1"), "u1")?.reason()).toBe("waived");
  const missing = AttributeCoverage.of({
    required: paths("R.a", "R.b", "R.c"),
    mapped: paths("R.a"),
    waived: paths("R.b"),
    missing: paths("R.c"),
  });
  expect(missing.forInvariant().gapDetail()).toBe(
    "depends on attribute(s) R.b, R.c that are neither mapped nor in unmapped[]",
  );
});

test("coverage rejects extraneous members and size overflow before classifying them", () => {
  expect(
    AttributeCoverage.parse({ required: paths("R.a"), mapped: paths("R.a", "R.b"), waived: paths(), missing: paths() }),
  ).toEqual({ ok: false, error: { kind: "attribute-coverage-outside-subject" } });
  const tooMany = Array.from({ length: 65_537 }, (_, i) => AttributePath.of(`R.a${i}`));
  expect(() => AttributePaths.of(tooMany)).toThrow(IllegalArgumentException);
  const parsed = AttributePaths.parse(tooMany);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.error.kind).toBe("too-many-attribute-paths");
    expect(parsed.error).not.toBeInstanceOf(Error);
  }
});

test("coverage preserves event numeric order and scenario lexical order", () => {
  const empty = AttributeCoverage.parse({ required: paths(), mapped: paths(), waived: paths(), missing: paths() });
  expect(empty.ok).toBe(true);
  const coverage = AttributeCoverage.of({
    required: paths("R.a10", "R.a2"),
    mapped: paths(),
    waived: paths(),
    missing: paths("R.a10", "R.a2"),
  });
  expect(coverage.forEvent().gapDetail()).toBe(
    "depends on attribute(s) R.a2, R.a10 that are neither mapped nor in unmapped[]",
  );
  expect(coverage.forScenario().gapDetail()).toBe(
    "binds attribute(s) R.a10, R.a2 that are neither mapped nor in unmapped[]",
  );
});
