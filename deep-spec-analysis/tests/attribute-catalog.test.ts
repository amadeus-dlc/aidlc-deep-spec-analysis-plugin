import { expect, test } from "bun:test";
import {
  BusinessRuleReferences,
  DesignAttributeCatalog,
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignBackgroundAssumptions,
  DesignEntityDeclaration,
  DesignEntityDeclarations,
  DesignEntityName,
  DesignMachines,
  DesignObligation,
  DesignObligationIdentifier,
  DesignObligationOrigin,
  DesignObligations,
  DesignScenarios,
  DesignUnit,
} from "@deep-spec-analysis/design-domain";
import {
  AttributeKind,
  EnumerationMember,
  EnumerationMembers,
  FunctionalRequirementReferences,
  ObligationNature,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

import {
  IntermediateRepresentationAttributeCatalog,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationEntityDeclaration,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationEntityName,
} from "@deep-spec-analysis/requirements-domain";

const status = DesignAttributeDeclaration.of({
  name: DesignAttributeName.of("status"),
  kind: AttributeKind.of("enum"),
  values: EnumerationMembers.of([EnumerationMember.of("open")]),
});
const entity = (attributes = [status]) =>
  DesignEntityDeclaration.of({
    name: DesignEntityName.of("ticket"),
    attributes: DesignAttributeDeclarations.of(attributes),
  });

test("ambiguous entity and attribute declarations cannot become an executable catalog", () => {
  for (const declarations of [
    DesignEntityDeclarations.of([entity(), entity()]),
    DesignEntityDeclarations.of([entity([status, status])]),
  ]) {
    expect(() => DesignAttributeCatalog.of(declarations)).toThrow(IllegalArgumentException);
    const parsed = DesignAttributeCatalog.parse(declarations);
    expect(parsed).toEqual({ ok: false, error: { kind: "ambiguous-design-attributes" } });
    if (!parsed.ok) expect(parsed.error instanceof Error).toBe(false);
  }
});

test("the catalog resolves the declared enumeration and diagnoses unknown expression references", () => {
  const catalog = DesignAttributeCatalog.of(DesignEntityDeclarations.of([entity()]));
  expect(
    catalog
      .enumValuesAt("ticket.status")
      ?.toArray()
      .map((value) => value.asString()),
  ).toEqual(["open"]);
  expect(catalog.enumValuesAt("ticket.missing")).toBeNull();
  expect(
    [...catalog.expressionDiagnostics({ op: "ref", path: "" }, "obligation DOB-1", false)].map((message) =>
      message.asString(),
    ),
  ).toEqual(['obligation DOB-1: unresolvable reference ""']);
  expect(DesignAttributeCatalog.parse(DesignEntityDeclarations.of([])).ok).toBe(true);
});

test("catalog size is rejected before the repeated declarations are inspected for identity", () => {
  const oversized = DesignEntityDeclarations.of(Array.from({ length: 32_769 }, () => entity()));
  expect(() => DesignAttributeCatalog.of(oversized)).toThrow(IllegalArgumentException);
  expect(DesignAttributeCatalog.parse(oversized)).toEqual({
    ok: false,
    error: { kind: "attribute-catalog-too-large", raw: 65_537 },
  });
});

test("requirements catalogs apply the same construction contract to ambiguous declarations", () => {
  const declaration = IntermediateRepresentationEntityDeclaration.of({
    name: IntermediateRepresentationEntityName.of("ticket"),
    attributes: IntermediateRepresentationAttributeDeclarations.of([]),
  });
  const repeated = IntermediateRepresentationEntityDeclarations.of([declaration, declaration]);
  expect(() => IntermediateRepresentationAttributeCatalog.of(repeated)).toThrow(IllegalArgumentException);
  expect(IntermediateRepresentationAttributeCatalog.parse(repeated)).toEqual({
    ok: false,
    error: { kind: "ambiguous-requirement-attributes" },
  });
  expect([
    ...IntermediateRepresentationAttributeCatalog.of(IntermediateRepresentationEntityDeclarations.of([])).diagnostics(),
  ]).toHaveLength(0);
});

test("an executable unit rejects repeated verification targets", () => {
  const obligation = DesignObligation.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    nature: ObligationNature.of("invariant"),
    origin: DesignObligationOrigin.of(""),
    businessRuleReferences: BusinessRuleReferences.of([]),
    functionalRequirementReferences: FunctionalRequirementReferences.of([]),
    assert: { op: "bool", value: true },
  });
  const input = {
    unit: UnitName.of("u1"),
    catalog: DesignAttributeCatalog.of(DesignEntityDeclarations.of([])),
    obligations: DesignObligations.of([obligation, obligation]),
    machines: DesignMachines.of([]),
    scenarios: DesignScenarios.of([]),
    background: DesignBackgroundAssumptions.of([]),
  };
  expect(() => DesignUnit.of(input)).toThrow(IllegalArgumentException);
  expect(DesignUnit.parse(input)).toEqual({ ok: false, error: { kind: "duplicate-design-target" } });
});
