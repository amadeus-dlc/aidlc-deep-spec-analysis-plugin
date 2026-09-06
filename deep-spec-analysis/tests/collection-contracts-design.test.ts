import { expect, test } from "bun:test";
import {
  BusinessRuleReference,
  BusinessRuleReferenceIndex,
  BusinessRuleReferences,
  IssuedLoweredIdentifiers,
  LoweredIdentifier,
} from "@deep-spec-analysis/design-domain";

test("design collection emptiness describes owned elements, including a fully issued identifier budget", () => {
  expect(BusinessRuleReferences.of([]).isEmpty()).toBe(true);
  const reference = BusinessRuleReference.of("BR1.1");
  const input = [reference];
  const references = BusinessRuleReferences.of(input);
  input.length = 0;
  expect(references.isEmpty()).toBe(false);
  expect([...references].map((value) => value.asString())).toEqual(["BR1.1"]);
  expect(BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([])).isEmpty()).toBe(true);
  expect(BusinessRuleReferenceIndex.of(references).isEmpty()).toBe(false);
  expect(IssuedLoweredIdentifiers.of([]).isEmpty()).toBe(true);
  const exhausted = IssuedLoweredIdentifiers.of(
    Array.from({ length: 65_536 }, (_, index) => LoweredIdentifier.of(`OB-${index + 1}`)),
  );
  expect(exhausted.isEmpty()).toBe(false);
  expect([...exhausted.availableObligations()]).toEqual([]);
});

import {
  DesignAssignment,
  DesignAssignments,
  EffectAssignment,
  EffectAssignments,
} from "@deep-spec-analysis/design-domain";
import { AttributePath, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import { requireSuccess } from "./result-fixtures.ts";

test("effect assignments retain equations while design assignments expose only their right-hand expressions", () => {
  const ticket = AttributePath.of("ticket.state");
  const counter = AttributePath.of("ticket.count");
  const effect = ExpressionTree.of({
    op: "and",
    args: [
      {
        op: "eq",
        args: [
          { op: "ref", path: "ticket.state", prime: true },
          { op: "enum", value: "open" },
        ],
      },
      {
        op: "eq",
        args: [
          { op: "int", value: 1 },
          { op: "ref", path: "ticket.count", prime: true },
        ],
      },
      {
        op: "eq",
        args: [
          { op: "ref", path: "ticket.state", prime: true },
          { op: "enum", value: "closed" },
        ],
      },
    ],
  });
  const assignments = requireSuccess(EffectAssignments.fromEffect(effect));
  expect([...assignments].map((assignment) => assignment.target().asString())).toEqual([
    "ticket.state",
    "ticket.count",
  ]);
  expect([...assignments].map((assignment) => assignment.equation().asExpression())).toEqual([
    {
      op: "eq",
      args: [
        { op: "ref", path: "ticket.state", prime: true },
        { op: "enum", value: "closed" },
      ],
    },
    {
      op: "eq",
      args: [
        { op: "int", value: 1 },
        { op: "ref", path: "ticket.count", prime: true },
      ],
    },
  ]);
  const design = DesignAssignments.of([...assignments].map((assignment) => assignment.asDesignAssignment()));
  expect(design.rhsOf(ticket)).toEqual({ op: "enum", value: "closed" });
  expect(design.rhsOf(counter)).toEqual({ op: "int", value: 1 });
  expect(design.rhsOf(AttributePath.of("ticket.missing"))).toBeUndefined();
  const input = [DesignAssignment.of(ticket, ExpressionTree.of({ op: "enum", value: "open" }))];
  const owned = DesignAssignments.of(input);
  input.length = 0;
  expect(owned.rhsOf(ticket)).toEqual({ op: "enum", value: "open" });
  const replacement = DesignAssignments.of([
    DesignAssignment.of(ticket, ExpressionTree.of({ op: "enum", value: "open" })),
    DesignAssignment.of(ticket, ExpressionTree.of({ op: "enum", value: "closed" })),
  ]);
  expect(replacement.rhsOf(ticket)).toEqual({ op: "enum", value: "closed" });
  const supplied = [...assignments];
  const captured = EffectAssignments.of(supplied);
  supplied.length = 0;
  expect(captured.covers(ticket)).toBe(true);
  expect(captured.covers(counter)).toBe(true);
});

test("assignment construction rejects inconsistent targets and translates unsupported effects into ParseError", () => {
  const target = AttributePath.of("ticket.state");
  const wrong = ExpressionTree.of({
    op: "eq",
    args: [
      { op: "ref", path: "other.state", prime: true },
      { op: "enum", value: "closed" },
    ],
  });
  expect(() => EffectAssignment.of(target, wrong)).toThrow(IllegalArgumentException);
  const parsed = EffectAssignment.parse(target, wrong);
  expect(parsed).toEqual({ ok: false, error: { kind: "effect-not-assignment-conjunction" } });
  if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  for (const effect of [
    {
      op: "eq",
      args: [
        { op: "ref", prime: true },
        { op: "ref", path: "ticket.state", prime: true },
      ],
    },
    { op: "or", args: [] },
    {
      op: "eq",
      args: [
        { op: "ref", path: "ticket.state" },
        { op: "enum", value: "closed" },
      ],
    },
  ]) {
    const result = EffectAssignments.fromEffect(ExpressionTree.of(effect));
    expect(result).toEqual({ ok: false, error: { kind: "effect-not-assignment-conjunction" } });
    if (!result.ok) expect(result.error).not.toBeInstanceOf(Error);
  }
});

test("assignment collections keep the expression budget even when all supplied assignments are individually valid", () => {
  const target = AttributePath.of("ticket.state");
  const assignment = EffectAssignment.of(
    target,
    ExpressionTree.of({
      op: "eq",
      args: [
        { op: "ref", path: "ticket.state", prime: true },
        { op: "enum", value: "closed" },
      ],
    }),
  );
  expect(EffectAssignments.of(Array(3_333).fill(assignment)).covers(target)).toBe(true);
  const excessive = Array<EffectAssignment>(3_334).fill(assignment);
  expect(() => EffectAssignments.of(excessive)).toThrow(IllegalArgumentException);
  const effectResult = EffectAssignments.parse(excessive);
  expect(effectResult).toEqual({ ok: false, error: { kind: "expression-too-large" } });
  if (!effectResult.ok) expect(effectResult.error).not.toBeInstanceOf(Error);
  const design = assignment.asDesignAssignment();
  expect(DesignAssignments.of(Array(10_000).fill(design)).rhsOf(target)).toEqual({ op: "enum", value: "closed" });
  const tooMany = Array<DesignAssignment>(10_001).fill(design);
  expect(() => DesignAssignments.of(tooMany)).toThrow(IllegalArgumentException);
  const designResult = DesignAssignments.parse(tooMany);
  expect(designResult).toEqual({ ok: false, error: { kind: "expression-too-large" } });
  if (!designResult.ok) expect(designResult.error).not.toBeInstanceOf(Error);
  const computed = DesignAssignment.of(
    target,
    ExpressionTree.of({
      op: "add",
      args: [
        { op: "int", value: 1 },
        { op: "int", value: 2 },
      ],
    }),
  );
  const expanded = Array<DesignAssignment>(3_334).fill(computed);
  expect(() => DesignAssignments.of(expanded)).toThrow(IllegalArgumentException);
  expect(DesignAssignments.parse(expanded)).toEqual({ ok: false, error: { kind: "expression-too-large" } });
});

import * as Design from "@deep-spec-analysis/design-domain";
import {
  AttributeKind,
  FindingKind,
  FunctionalRequirementReferences,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";

function emptyDesignUnit(): Design.DesignUnit {
  return Design.DesignUnit.of({
    unit: UnitName.of("u1-tickets"),
    catalog: Design.DesignAttributeCatalog.of(Design.DesignEntityDeclarations.of([])),
    obligations: Design.DesignObligations.of([]),
    machines: Design.DesignMachines.of([]),
    scenarios: Design.DesignScenarios.of([]),
    background: Design.DesignBackgroundAssumptions.of([]),
  });
}

test("catalog emptiness counts attributes and event rules, independently from source entity declarations", () => {
  const attributes = Design.DesignAttributeDeclarations.of([]);
  const declarations = Design.DesignEntityDeclarations.of([
    Design.DesignEntityDeclaration.of({ name: Design.DesignEntityName.of("Ticket"), attributes }),
  ]);
  expect(declarations.isEmpty()).toBe(false);
  expect(Design.DesignAttributeCatalog.of(declarations).isEmpty()).toBe(true);
  const populated = Design.DesignEntityDeclarations.of([
    Design.DesignEntityDeclaration.of({
      name: Design.DesignEntityName.of("Ticket"),
      attributes: attributes.add(
        Design.DesignAttributeDeclaration.of({
          name: Design.DesignAttributeName.of("active"),
          kind: AttributeKind.of("bool"),
        }),
      ),
    }),
  ]);
  expect(Design.DesignAttributeCatalog.of(populated).isEmpty()).toBe(false);
  expect(Design.DesignEventRuleCatalog.of(emptyDesignUnit()).isEmpty()).toBe(true);
});

const emptyDesignCollections = [
  ["AttributeMappings", Design.AttributeMappings.of([])],
  ["AttributePaths", Design.AttributePaths.of([])],
  ["BusinessRuleReferenceIndex", Design.BusinessRuleReferenceIndex.of(Design.BusinessRuleReferences.of([]))],
  ["BusinessRuleReferences", Design.BusinessRuleReferences.of([])],
  ["CheckedUnits", Design.CheckedUnits.of([])],
  ["DesignAssignments", Design.DesignAssignments.of([])],
  ["DesignAttributeCatalog", Design.DesignAttributeCatalog.of(Design.DesignEntityDeclarations.of([]))],
  ["DesignAttributeDeclarations", Design.DesignAttributeDeclarations.of([])],
  ["DesignBackgroundAssumptions", Design.DesignBackgroundAssumptions.of([])],
  ["DesignBackgroundDeclarations", Design.DesignBackgroundDeclarations.of([])],
  ["DesignCrossCheckedEntries", Design.DesignCrossCheckedEntries.of([])],
  ["DesignEntityDeclarations", Design.DesignEntityDeclarations.of([])],
  ["DesignEventRuleCatalog", Design.DesignEventRuleCatalog.of(emptyDesignUnit())],
  ["DesignFindings", Design.DesignFindings.of([])],
  ["DesignIgnoreDeclarations", Design.DesignIgnoreDeclarations.of([])],
  ["DesignIgnores", Design.DesignIgnores.of([])],
  ["DesignInputAnchors", Design.DesignInputAnchors.of([])],
  ["DesignMachineDeclarations", Design.DesignMachineDeclarations.of([])],
  ["DesignMachines", Design.DesignMachines.of([])],
  ["DesignObligationDeclarations", Design.DesignObligationDeclarations.of([])],
  ["DesignObligations", Design.DesignObligations.of([])],
  ["DesignReports", Design.DesignReports.of([])],
  ["DesignScenarioDeclarations", Design.DesignScenarioDeclarations.of([])],
  ["DesignScenarios", Design.DesignScenarios.of([])],
  ["DesignSkips", Design.DesignSkips.of([])],
  ["DesignTransitionDeclarations", Design.DesignTransitionDeclarations.of([])],
  ["DesignTransitions", Design.DesignTransitions.of([])],
  ["DesignUnitDeclarations", Design.DesignUnitDeclarations.of([])],
  ["DesignUnits", Design.DesignUnits.of([])],
  ["EffectAssignments", Design.EffectAssignments.of([])],
  ["EventMappings", Design.EventMappings.of([])],
  ["InitialStates", Design.InitialStates.of([])],
  ["IssuedLoweredIdentifiers", Design.IssuedLoweredIdentifiers.of([])],
  ["LoweredBackgrounds", Design.LoweredBackgrounds.of([])],
  ["LoweredObligations", Design.LoweredObligations.of([])],
  ["LoweredScenarios", Design.LoweredScenarios.of([])],
  ["ReachabilityPlan", Design.ReachabilityPlan.of([])],
  ["RefinementAttributes", Design.RefinementAttributes.of([])],
  ["RefinementObligations", Design.RefinementObligations.of([])],
  ["RefinementQueryVerdicts", Design.RefinementQueryVerdicts.of([])],
  ["RefinementQuintInvariants", Design.RefinementQuintInvariants.of([])],
  ["RefinementScenarios", Design.RefinementScenarios.of([])],
  ["RefinementUnitMaps", Design.RefinementUnitMaps.of([])],
  ["RuleSubsumptions", Design.RuleSubsumptions.of([])],
  ["SiblingVerdictFindings", Design.SiblingVerdictFindings.of([])],
  ["SiblingVerdictSkips", Design.SiblingVerdictSkips.of([])],
  ["TransitionReferences", Design.TransitionReferences.of([])],
  ["UnformalizedTargets", Design.UnformalizedTargets.of([])],
  ["UnmappedDeclarations", Design.UnmappedDeclarations.of([])],
] as const;

for (const [name, collection] of emptyDesignCollections) {
  test(`${name} represents a collection with no owned elements`, () => {
    expect(collection.isEmpty()).toBe(true);
  });
}

test("a sibling finding with no mapped target cannot become a design finding", () => {
  const sibling = Design.SiblingVerdictFinding.of({
    kind: FindingKind.conflict(),
    functionalRequirementReferences: FunctionalRequirementReferences.of([]),
    targets: [],
    witness: Design.DesignWitness.of({}),
    detail: "missing target",
  });
  const index = Design.LoweringIndex.of(
    Design.LoweredObligations.of([]),
    Design.LoweredScenarios.of([]),
    Design.DesignMachines.of([]),
    Design.LoweredBackgrounds.of([]),
  );
  expect(sibling.remap(UnitName.of("u1-tickets"), index)).toEqual({
    kind: "invalid",
    error: { kind: "empty-finding-targets" },
  });
});
