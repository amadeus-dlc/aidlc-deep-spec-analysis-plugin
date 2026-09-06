import { expect, test } from "bun:test";
import * as Design from "@deep-spec-analysis/design-domain";
import * as Kernel from "@deep-spec-analysis/kernel-domain";
import { ScenarioExpectation } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import * as ReferenceCheck from "@deep-spec-analysis/refcheck-domain";
import * as Requirements from "@deep-spec-analysis/requirements-domain";

function rejects<P>(
  factory: { readonly name: string; of(value: P): object; parse(value: P): Result<object, ParseError> },
  value: P,
): void {
  test(`${factory.name}: delegated constructor violations panic through of and become ParseError through parse`, () => {
    expect(() => factory.of(value)).toThrow(IllegalArgumentException);
    const parsed = factory.parse(value);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).not.toBeInstanceOf(Error);
      expect(parsed.error.kind.length).toBeGreaterThan(0);
    }
  });
}

const badExpression: Kernel.Expression = { op: "ref", path: "x".repeat(258) };
const references = Kernel.FunctionalRequirementReferences.of([]);
const rules = Design.BusinessRuleReferences.of([]);
const bindings = Kernel.ScenarioBindings.of([]);
const declarations = Kernel.DeclaredBindings.of([]);
const obligation = Requirements.ObligationIdentifier.of("OB-1");
const scenario = Requirements.ScenarioIdentifier.of("SC-1");
const background = Requirements.BackgroundAssumptionIdentifier.of("BG-1");
const designObligation = Design.DesignObligationIdentifier.of("DOB-1");
const designScenario = Design.DesignScenarioIdentifier.of("DSC-1");
const designBackground = Design.DesignBackgroundIdentifier.of("DBG-1");
const transition = Design.DesignTransitionIdentifier.of("TR-1");

rejects(Requirements.Obligation, {
  id: obligation,
  nature: Kernel.ObligationNature.of("invariant"),
  functionalRequirementReferences: references,
  assert: badExpression,
});
rejects(Requirements.Scenario, {
  id: scenario,
  expectation: ScenarioExpectation.of("accept"),
  functionalRequirementReferences: references,
  bindings,
  expect: badExpression,
});
rejects(Requirements.IntermediateRepresentationObligationDeclaration, { id: obligation, assert: badExpression });
rejects(Requirements.IntermediateRepresentationScenarioDeclaration, {
  id: scenario,
  bindings: declarations,
  hasEvent: false,
  expect: badExpression,
});
rejects(Requirements.IntermediateRepresentationBackgroundDeclaration, { id: background, assert: badExpression });
rejects(Requirements.IntermediateRepresentationTemporalDeclaration, { assert: badExpression });
rejects(Requirements.QuintMachineComponent, { id: obligation, expression: badExpression });
rejects(Requirements.SatisfiabilityModuloTheoriesQueryVerdict, { status: "unsat", core: [""] });
rejects(Design.RefinementQueryVerdict, { status: "unsat", core: [""] });
rejects(Design.RefinementObligation, {
  id: obligation,
  nature: Kernel.ObligationNature.of("invariant"),
  functionalRequirementReferences: references,
  assert: badExpression,
});
rejects(Design.DesignObligation, {
  id: designObligation,
  nature: Design.DesignObligationNature.of("invariant"),
  origin: Design.DesignObligationOrigin.of(""),
  businessRuleReferences: rules,
  functionalRequirementReferences: references,
  assert: badExpression,
});
rejects(Design.DesignScenario, {
  id: designScenario,
  expectation: ScenarioExpectation.of("accept"),
  businessRuleReferences: rules,
  functionalRequirementReferences: references,
  bindings,
  expect: badExpression,
});
rejects(Design.DesignTransition, {
  id: transition,
  from: "open",
  to: "closed",
  trigger: Kernel.TriggerName.of("go"),
  businessRuleReferences: rules,
  effect: badExpression,
});
rejects(Design.DesignTransitionDeclaration, { id: transition, effect: badExpression });
rejects(Design.DesignObligationDeclaration, { id: designObligation, assert: badExpression });
rejects(Design.DesignScenarioDeclaration, {
  id: designScenario,
  bindings: declarations,
  hasEvent: false,
  expect: badExpression,
});
rejects(Design.DesignBackgroundDeclaration, { id: designBackground, assert: badExpression });
rejects(Design.LoweredObligation, {
  origin: Design.LoweredOrigin.of({ kind: "passthrough", design: Design.LoweredOriginReference.of("DOB-1") }),
  id: Design.LoweredIdentifier.of("OB-1"),
  nature: "invariant",
  functionalRequirementReferences: references,
  assert: badExpression,
});
rejects(Design.LoweredScenario, {
  origin: Design.DesignScenarioIdentifier.of("DSC-1"),
  id: Design.LoweredIdentifier.of("SC-1"),
  expectation: ScenarioExpectation.of("accept"),
  functionalRequirementReferences: references,
  bindings,
  expect: badExpression,
});
rejects(Design.LoweredBackground, { id: Design.LoweredIdentifier.of("BG-1"), assert: badExpression });
rejects(Design.DesignAssignments, Kernel.KeyedIndex.of([[Kernel.AttributePath.of("ticket.state"), badExpression]]));
rejects(ReferenceCheck.InputAnchor, { artifact: "", sha256: Kernel.ContentHash.ofText("fixture") });
rejects(Design.DesignInputAnchor, { artifact: "", sha256: Kernel.ContentHash.ofText("fixture") });
rejects(ReferenceCheck.WitnessReference, { artifact: "", element: "field" });
rejects(Design.DesignUnit, {
  unit: "",
  catalog: Design.DesignAttributeCatalog.of(Design.DesignEntityDeclarations.of([])),
  obligations: Design.DesignObligations.of([]),
  machines: Design.DesignMachines.of([]),
  scenarios: Design.DesignScenarios.of([]),
  background: Design.DesignBackgroundAssumptions.of([]),
});
rejects(Design.EffectAssignments, { op: "or", args: [] });

rejects(
  {
    name: "DesignEvent",
    of: (value: Kernel.Expression) =>
      Design.DesignEvent.of({
        reference: Design.LoweredOriginReference.of("DOB-1"),
        trigger: Kernel.TriggerName.of("save"),
        guard: value,
        effect: { op: "bool", value: true },
      }),
    parse: (value: Kernel.Expression) =>
      Design.DesignEvent.parse({
        reference: Design.LoweredOriginReference.of("DOB-1"),
        trigger: Kernel.TriggerName.of("save"),
        guard: value,
        effect: { op: "bool", value: true },
      }),
  },
  badExpression,
);
rejects(Requirements.BackgroundAssumption, { id: background, assert: badExpression });
rejects(Design.DesignBackgroundAssumption, { id: designBackground, assert: badExpression });
rejects(
  {
    name: "RefinementQuintInvariant",
    of: (value: Kernel.Expression) => Design.RefinementQuintInvariant.of(obligation, references, value),
    parse: (value: Kernel.Expression) => Design.RefinementQuintInvariant.parse(obligation, references, value),
  },
  badExpression,
);
