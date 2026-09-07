import { expect, test } from "bun:test";
import {
  decodeDesignModel,
  type RefinementSatisfiabilityModuloTheoriesContext,
} from "@deep-spec-analysis/design-adapter";
import { parseYamlSubset } from "@deep-spec-analysis/kernel-adapter";
import {
  ArtifactPath,
  AttributePath,
  ContentHash,
  IntermediateRepresentationVersion,
} from "@deep-spec-analysis/kernel-domain";
import { combineResults, err, ok } from "@deep-spec-analysis/kernel-infrastructure";
import { parseEntitiesDocument } from "@deep-spec-analysis/refcheck-adapter";
import { decodeSolverModel } from "@deep-spec-analysis/requirements-adapter";
import {
  BackgroundAssumptions,
  FormalModelIdentifier,
  Obligations,
  RequirementAttributeDeclaration,
  RequirementAttributeDeclarations,
  RequirementsModel,
  Scenarios,
} from "@deep-spec-analysis/requirements-domain";

const reservedKey = "__proto__";

test("YAML mappings keep __proto__ as data and do not expose inherited entities", () => {
  const yaml = [
    "__proto__:",
    "  entities:",
    "    - name: Ghost",
    "      attributes:",
    "        - name: active",
    "          type: bool",
  ].join("\n");

  const parsed = parseYamlSubset(yaml);
  expect(JSON.stringify(parsed.value)).toBe(
    '{"__proto__":{"entities":[{"name":"Ghost","attributes":[{"name":"active","type":"bool"}]}]}}',
  );

  const outcome = parseEntitiesDocument(["```yaml", yaml, "```", ""].join("\n"));
  const detail = outcome.match({
    absent: () => "absent",
    wrongFenceCount: (found) => `wrong-fence-count:${found}`,
    unparseable: (_line, error) => error,
    extracted: (entities) => `extracted:${entities.entities().count()}`,
  });
  expect(detail).toBe("extracted:0");
});

test("combineResults preserves reserved string keys and symbol keys", () => {
  const symbol = Symbol("field");
  const result = combineResults({
    ["__proto__"]: ok({ marker: true }),
    [symbol]: ok(23),
    normal: ok(7),
  });

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(Object.hasOwn(result.value, reservedKey)).toBe(true);
    expect(result.value[reservedKey]).toEqual({ marker: true });
    expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    expect(Object.getOwnPropertySymbols(result.value)).toEqual([symbol]);
    expect(result.value[symbol]).toBe(23);
    expect(result.value.normal).toBe(7);
  }
});

test("combineResults propagates a failure held by a symbol key", () => {
  const symbol = Symbol("failure");
  const result = combineResults({ [symbol]: err<string>("symbol failure"), normal: ok(7) });

  expect(result).toEqual(err("symbol failure"));
});

test("combineResults ignores inherited fields", () => {
  const fields = { own: ok(7) };
  Object.setPrototypeOf(fields, { inherited: ok("do not copy") });

  const result = combineResults(fields);

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value).toEqual({ own: 7 });
    expect(Object.hasOwn(result.value, "inherited")).toBe(false);
  }
});

test("combineResults returns arrays and preserves sparse array holes", () => {
  const fields = [ok(2), ok(3)];
  delete fields[0];

  const result = combineResults(fields);

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value.length).toBe(2);
    expect(0 in result.value).toBe(false);
    expect(result.value[1]).toBe(3);
  }
});

test("combineResults preserves tuple output types", () => {
  const fields = [ok(2), ok("three")] as const;
  const result = combineResults(fields);

  expect(result.ok).toBe(true);
  if (result.ok) {
    const values: readonly [number, string] = result.value;
    expect(values).toEqual([2, "three"]);
  }
});

function requirementsModelWithReservedPath(): RequirementsModel {
  return RequirementsModel.of({
    id: FormalModelIdentifier.of(ArtifactPath.of("/model")),
    irHash: ContentHash.ofText("fixture"),
    sourceDocument: new Uint8Array(),
    irVersion: IntermediateRepresentationVersion.of("1.0.0"),
    attributes: RequirementAttributeDeclarations.of([
      RequirementAttributeDeclaration.of({ path: AttributePath.of("__proto__"), kind: "bool" }),
    ]),
    obligations: Obligations.of([]),
    scenarios: Scenarios.of([]),
    background: BackgroundAssumptions.of([]),
  });
}

test("decodeSolverModel preserves a reserved attribute path", () => {
  const result = decodeSolverModel(requirementsModelWithReservedPath(), { v___proto__: "true" });

  expect(Object.hasOwn(result, reservedKey)).toBe(true);
  expect(result[reservedKey]).toBe(true);
  expect(JSON.stringify(result)).toBe('{"__proto__":true}');
});

test("decodeDesignModel preserves a reserved attribute path", () => {
  const attribute = { path: "__proto__", kind: "bool" as const };
  const context: RefinementSatisfiabilityModuloTheoriesContext = {
    attrs: [attribute],
    byPath: new Map([[attribute.path, attribute]]),
  };

  const result = decodeDesignModel(context, { v___proto__: "true" }, false);

  expect(Object.hasOwn(result, reservedKey)).toBe(true);
  expect(result[reservedKey]).toBe(true);
  expect(JSON.stringify(result)).toBe('{"__proto__":true}');
});
