import { expect, test } from "bun:test";
import { RefinementQueryVerdict } from "@deep-spec-analysis/design-domain";
import { parseSolverChildResults } from "@deep-spec-analysis/kernel-adapter";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import { SatisfiabilityModuloTheoriesQueryVerdict } from "@deep-spec-analysis/requirements-domain";

test("solver child results accept exactly 65,536 results", () => {
  const ids = Array.from({ length: 65_536 }, (_, index) => `q-${index}`);
  const parsed = parseSolverChildResults({ results: ids.map((id) => ({ id, status: "unknown" })) }, ids);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.value.size).toBe(65_536);
    expect(parsed.value.get("q-65535")?.status).toBe("unknown");
  }
});

test("solver child results bound query ids before hashing or diagnostics", () => {
  const longId = "q".repeat(2049);
  expect(parseSolverChildResults({ results: [] }, [longId]).ok).toBe(false);
  expect(parseSolverChildResults({ results: [{ id: longId, status: "sat" }] }, ["q"]).ok).toBe(false);
});

test("solver protocol and domain verdicts retain their own model and core snapshots", () => {
  const model = { value: "true" };
  const core = ["label"];
  const parsed = parseSolverChildResults({ results: [{ id: "q", status: "sat", model, core }] }, ["q"]);
  model.value = "false";
  core[0] = "changed";
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.value.get("q")?.model).toEqual({ value: "true" });
    expect(parsed.value.get("q")?.core).toEqual(["label"]);
  }

  const decodedModel = { "E.flag": true };
  const labels = ["label"];
  const props = { status: "sat" as const, decodedModel, core: labels };
  const verdicts = [SatisfiabilityModuloTheoriesQueryVerdict.of(props), RefinementQueryVerdict.of(props)];
  decodedModel["E.flag"] = false;
  labels[0] = "changed";
  for (const verdict of verdicts) {
    expect(verdict.witnessModel()).toEqual({ "E.flag": true });
    expect(verdict.sortedCore()).toEqual(["label"]);
  }
});

test("solver child results reject more than 65,536 result entries", () => {
  const ids = Array.from({ length: 65_537 }, (_, index) => `q-${index}`);
  const result = parseSolverChildResults({ results: ids.map((id) => ({ id, status: "unknown" })) }, ids);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("65,536");
});

test("solver child results bound expected-id iteration even when array length lies", () => {
  const expectedIds = ["q"];
  Object.defineProperty(expectedIds, Symbol.iterator, {
    value: function* () {
      for (let index = 0; index < 65_537; index++) yield "q";
    },
  });

  const result = parseSolverChildResults({ results: [{ id: "q", status: "unknown" }] }, expectedIds);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("65,536");
});

test("solver child results reject an oversized model before copying it", () => {
  const model = Object.fromEntries(Array.from({ length: 65_537 }, (_, index) => [`v-${index}`, "true"]));
  const result = parseSolverChildResults({ results: [{ id: "q", status: "sat", model }] }, ["q"]);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("model");
});

test("solver child results reject an oversized core before copying it", () => {
  const core = Array.from({ length: 65_537 }, (_, index) => `q:${index}`);
  const result = parseSolverChildResults({ results: [{ id: "q", status: "unsat", core }] }, ["q"]);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("core");
});

test("solver child results reject an oversized field string", () => {
  const result = parseSolverChildResults(
    { results: [{ id: "q", status: "sat", model: { value: "x".repeat(65_537) } }] },
    ["q"],
  );

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("model");
});

test("solver child results reject a model whose total text exceeds 16 Mi code units", () => {
  const model = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`v-${index}`, "x".repeat(65_536)]));
  const result = parseSolverChildResults({ results: [{ id: "q", status: "sat", model }] }, ["q"]);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("model");
});

test("requirements verdict of panics and parse returns a non-Error size failure", () => {
  const props = { status: "sat" as const, core: Array.from({ length: 65_537 }, (_, index) => `q:${index}`) };

  expect(() => SatisfiabilityModuloTheoriesQueryVerdict.of(props)).toThrow(IllegalArgumentException);
  const parsed = SatisfiabilityModuloTheoriesQueryVerdict.parse(props);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
});

test("refinement verdict of panics and parse returns a non-Error size failure", () => {
  const props = { status: "sat" as const, core: Array.from({ length: 65_537 }, (_, index) => `q:${index}`) };

  expect(() => RefinementQueryVerdict.of(props)).toThrow(IllegalArgumentException);
  const parsed = RefinementQueryVerdict.parse(props);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
});
