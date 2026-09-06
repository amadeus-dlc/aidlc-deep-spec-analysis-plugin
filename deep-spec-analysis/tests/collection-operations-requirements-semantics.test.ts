import { expect, test } from "bun:test";
import {
  ArtifactPath,
  AttributeBound,
  AttributeKind,
  AttributePath,
  BackendName,
  BindingDeclaration,
  ContentHash,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  EnumerationMember,
  EnumerationMembers,
  FindingKind,
  FindingTargets,
  FunctionalRequirementReferences,
  ImmutableFirstClassCollection,
  IntermediateRepresentationVersion,
  ObligationNature,
  QueryLabel,
  RequirementIdentifier,
  RequirementIdentifiers,
  ScenarioBindings,
  ScenarioExpectation,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import {
  BackgroundAssumption,
  BackgroundAssumptionIdentifier,
  BackgroundAssumptions,
  CrossCheckedEntries,
  CrossCheckedEntry,
  FunctionalRequirementReferenceClaim,
  FunctionalRequirementReferenceClaims,
  FunctionalRequirementReferenceIndex,
  IntermediateRepresentationAttributeCatalog,
  IntermediateRepresentationAttributeDeclaration,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationAttributeEntry,
  IntermediateRepresentationAttributeName,
  IntermediateRepresentationBackgroundDeclaration,
  IntermediateRepresentationBackgroundDeclarations,
  IntermediateRepresentationEntityDeclaration,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationEntityName,
  IntermediateRepresentationObligationDeclaration,
  IntermediateRepresentationObligationDeclarations,
  IntermediateRepresentationScenarioDeclaration,
  IntermediateRepresentationScenarioDeclarations,
  IntermediateRepresentationTemporalDeclaration,
  Obligation,
  ObligationIdentifier,
  ObligationIdentifiers,
  Obligations,
  QuintMachineComponent,
  QuintMachineComponents,
  RequirementAttributeDeclaration,
  RequirementAttributeDeclarations,
  SatisfiabilityModuloTheoriesEventPairProbe,
  SatisfiabilityModuloTheoriesEventPairProbes,
  SatisfiabilityModuloTheoriesQueryVerdict,
  SatisfiabilityModuloTheoriesQueryVerdictEntry,
  SatisfiabilityModuloTheoriesQueryVerdicts,
  Scenario,
  ScenarioIdentifier,
  Scenarios,
  TraceState,
  TraceStateEntry,
  TraceStates,
  TraceValue,
  VerificationFinding,
  VerificationFindings,
  VerificationReport,
  VerificationReportIdentifier,
  VerificationReports,
  VerificationSkipped,
  VerificationSkips,
  VerificationWitness,
} from "@deep-spec-analysis/requirements-domain";

type BoolExpression = { readonly op: "bool"; readonly value: boolean };
const expression: BoolExpression = { op: "bool", value: true };
const refs = (): FunctionalRequirementReferences =>
  FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]);
const bindingSet = (): DeclaredBindings => DeclaredBindings.of([]);
const scenarioBindingSet = (): ScenarioBindings => ScenarioBindings.of([]);
const declaredBindingSet = (value: boolean): DeclaredBindings =>
  DeclaredBindings.of([
    BindingDeclaration.of(AttributePath.of("Account.active"), DeclaredBindingValue.of(Declaration.of(value))),
  ]);

const background = (assertion = expression): BackgroundAssumption =>
  BackgroundAssumption.of({ id: BackgroundAssumptionIdentifier.of("BG-1"), assert: assertion });

const crossChecked = (backend = "smt"): CrossCheckedEntry =>
  CrossCheckedEntry.of({
    backend: BackendName.of(backend),
    targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]),
  });

const irAttribute = (kind = "bool" as "bool" | "int" | "enum"): IntermediateRepresentationAttributeDeclaration =>
  IntermediateRepresentationAttributeDeclaration.of({
    name: IntermediateRepresentationAttributeName.of("active"),
    kind: AttributeKind.of(kind),
  });

const irEntity = (attribute = irAttribute()): IntermediateRepresentationEntityDeclaration =>
  IntermediateRepresentationEntityDeclaration.of({
    name: IntermediateRepresentationEntityName.of("Account"),
    attributes: IntermediateRepresentationAttributeDeclarations.of([attribute]),
  });

const irBackground = (
  assertion: BoolExpression | undefined = expression,
): IntermediateRepresentationBackgroundDeclaration =>
  IntermediateRepresentationBackgroundDeclaration.of({
    id: BackgroundAssumptionIdentifier.of("BG-1"),
    ...(assertion === undefined ? {} : { assert: assertion }),
  });

const irObligation = (assertion: BoolExpression = expression): IntermediateRepresentationObligationDeclaration =>
  IntermediateRepresentationObligationDeclaration.of({
    id: ObligationIdentifier.of("OB-1"),
    assert: assertion,
    temporal: IntermediateRepresentationTemporalDeclaration.of({ assert: expression }),
  });

const irScenario = (hasEvent = false): IntermediateRepresentationScenarioDeclaration =>
  IntermediateRepresentationScenarioDeclaration.of({
    id: ScenarioIdentifier.of("SC-1"),
    bindings: bindingSet(),
    hasEvent,
    expect: expression,
  });

const irScenarioWithBinding = (value: boolean): IntermediateRepresentationScenarioDeclaration =>
  IntermediateRepresentationScenarioDeclaration.of({
    id: ScenarioIdentifier.of("SC-1"),
    bindings: declaredBindingSet(value),
    hasEvent: false,
    expect: expression,
  });

const obligation = (assertion: BoolExpression = expression): Obligation =>
  Obligation.of({
    id: ObligationIdentifier.of("OB-1"),
    nature: ObligationNature.of("invariant"),
    functionalRequirementReferences: refs(),
    assert: assertion,
    temporal: { pattern: "always", assert: expression },
  });

const requirementAttribute = (kind: "bool" | "int" | "enum" = "bool"): RequirementAttributeDeclaration =>
  RequirementAttributeDeclaration.of({
    path: AttributePath.of("Account.active"),
    kind,
    ...(kind === "int" ? { min: AttributeBound.of(0), max: AttributeBound.of(10) } : {}),
    ...(kind === "enum"
      ? { values: EnumerationMembers.of([EnumerationMember.of("open"), EnumerationMember.of("closed")]) }
      : {}),
  });

const scenario = (expectation: "accept" | "reject" = "accept"): Scenario =>
  Scenario.of({
    id: ScenarioIdentifier.of("SC-1"),
    expectation: ScenarioExpectation.of(expectation),
    functionalRequirementReferences: refs(),
    bindings: scenarioBindingSet(),
  });

const machineComponent = (assertion = expression): QuintMachineComponent =>
  QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: assertion });

const eventPairProbe = (trigger = "submit"): SatisfiabilityModuloTheoriesEventPairProbe =>
  SatisfiabilityModuloTheoriesEventPairProbe.of({
    qOverlap: QueryLabel.of("q:overlap"),
    qJoint: QueryLabel.of("q:joint"),
    a: ObligationIdentifier.of("OB-1"),
    b: ObligationIdentifier.of("OB-2"),
    trigger: TriggerName.of(trigger),
  });

const queryEntry = (status: "sat" | "unsat" = "sat"): SatisfiabilityModuloTheoriesQueryVerdictEntry =>
  SatisfiabilityModuloTheoriesQueryVerdictEntry.of(
    QueryLabel.of("q:one"),
    SatisfiabilityModuloTheoriesQueryVerdict.of({ status }),
  );

const traceEntry = (value: boolean | number | string = true): TraceStateEntry =>
  TraceStateEntry.of(AttributePath.of("Account.active"), TraceValue.of(value));

const finding = (detail = "detail"): VerificationFinding =>
  VerificationFinding.of({
    kind: FindingKind.conflict(),
    functionalRequirementReferences: refs(),
    targets: FindingTargets.of(TargetIdentifier.of("OB-1"), []),
    witness: VerificationWitness.core(["OB-1"]),
    detail,
  });

const skipped = (reason: "timeout" | "capability" = "timeout"): VerificationSkipped =>
  VerificationSkipped.of({
    target: TargetIdentifier.of("OB-1"),
    reason: reason === "timeout" ? SkipReason.timeout() : SkipReason.capability(),
    detail: "detail",
  });

const report = (detail = "detail"): VerificationReport =>
  VerificationReport.of({
    id: VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "smt"),
    irVersion: IntermediateRepresentationVersion.of("1.0.0"),
    irHash: ContentHash.ofText("model"),
    method: VerificationMethod.of("exhaustive"),
    findings: VerificationFindings.of([finding(detail)]),
    skipped: VerificationSkips.of([skipped()]),
    crossChecked: null,
    unavailableReason: null,
  });

test("requirementsの全FCCはtail/filterで具体型を保ち、入力順と不変性を保つ", () => {
  const claim = FunctionalRequirementReferenceClaim.of("OB-1", refs());
  const attribute = irAttribute();
  const entities = IntermediateRepresentationEntityDeclarations.of([irEntity(attribute)]);
  const state = TraceState.of([traceEntry()]);
  const cases = [
    [BackgroundAssumptions.of([background()]), BackgroundAssumptions, background()],
    [CrossCheckedEntries.of([crossChecked()]), CrossCheckedEntries, crossChecked()],
    [FunctionalRequirementReferenceClaims.of([claim]), FunctionalRequirementReferenceClaims, claim],
    [FunctionalRequirementReferenceIndex.of([claim]), FunctionalRequirementReferenceIndex, claim],
    [IntermediateRepresentationAttributeCatalog.of(entities), IntermediateRepresentationAttributeCatalog, undefined],
    [
      IntermediateRepresentationAttributeDeclarations.of([attribute]),
      IntermediateRepresentationAttributeDeclarations,
      attribute,
    ],
    [
      IntermediateRepresentationBackgroundDeclarations.of([irBackground()]),
      IntermediateRepresentationBackgroundDeclarations,
      irBackground(),
    ],
    [
      IntermediateRepresentationEntityDeclarations.of([irEntity()]),
      IntermediateRepresentationEntityDeclarations,
      irEntity(),
    ],
    [
      IntermediateRepresentationObligationDeclarations.of([irObligation()]),
      IntermediateRepresentationObligationDeclarations,
      irObligation(),
    ],
    [
      IntermediateRepresentationScenarioDeclarations.of([irScenario()]),
      IntermediateRepresentationScenarioDeclarations,
      irScenario(),
    ],
    [
      ObligationIdentifiers.of([ObligationIdentifier.of("OB-1")]),
      ObligationIdentifiers,
      ObligationIdentifier.of("OB-1"),
    ],
    [Obligations.of([obligation()]), Obligations, obligation()],
    [QuintMachineComponents.of([machineComponent()]), QuintMachineComponents, machineComponent()],
    [
      RequirementAttributeDeclarations.of([
        RequirementAttributeDeclaration.of({ path: AttributePath.of("Account.active"), kind: "bool" }),
      ]),
      RequirementAttributeDeclarations,
      undefined,
    ],
    [
      SatisfiabilityModuloTheoriesEventPairProbes.of([eventPairProbe()]),
      SatisfiabilityModuloTheoriesEventPairProbes,
      eventPairProbe(),
    ],
    [
      SatisfiabilityModuloTheoriesQueryVerdicts.of([queryEntry()]),
      SatisfiabilityModuloTheoriesQueryVerdicts,
      queryEntry(),
    ],
    [Scenarios.of([scenario()]), Scenarios, scenario()],
    [state, TraceState, traceEntry()],
    [TraceStates.of([state]), TraceStates, state],
    [VerificationFindings.of([finding()]), VerificationFindings, finding()],
    [VerificationReports.of([report()]), VerificationReports, report()],
    [VerificationSkips.of([skipped()]), VerificationSkips, skipped()],
  ] as const;

  const entryResult = IntermediateRepresentationAttributeEntry.parse(
    IntermediateRepresentationEntityName.of("Account"),
    attribute,
  );
  expect(entryResult.ok).toBe(true);

  for (const [collection, type] of cases) {
    expect(collection.tail()).toBeInstanceOf(type);
    expect(collection.filter(() => true)).toBeInstanceOf(type);
    expect(collection.filter(() => false).isEmpty()).toBe(true);
  }
  const source = [background(), background({ op: "bool", value: false })];
  const owned = BackgroundAssumptions.of(source);
  source.length = 0;
  expect([...owned].map((value) => value.id().asString())).toEqual(["BG-1", "BG-1"]);
  const index = FunctionalRequirementReferenceIndex.of([claim]);
  expect(index.missingErrors(RequirementIdentifiers.of([]))).toEqual([
    'frRef "FR-1" (used by OB-1) does not exist in requirements.md',
  ]);
});

test("requirements要素のequalsは独立instanceの意味値を比較する", () => {
  expect(background().equals(background())).toBe(true);
  expect(background().equals(background({ op: "bool", value: false }))).toBe(false);
  expect(crossChecked().equals(crossChecked())).toBe(true);
  expect(crossChecked().equals(crossChecked("quint"))).toBe(false);
  expect(irAttribute().equals(irAttribute())).toBe(true);
  expect(irAttribute().equals(irAttribute("int"))).toBe(false);
  const entry = IntermediateRepresentationAttributeEntry.of(
    IntermediateRepresentationEntityName.of("Account"),
    irAttribute(),
  );
  expect(
    entry.equals(
      IntermediateRepresentationAttributeEntry.of(IntermediateRepresentationEntityName.of("Account"), irAttribute()),
    ),
  ).toBe(true);
  expect(
    entry.equals(
      IntermediateRepresentationAttributeEntry.of(IntermediateRepresentationEntityName.of("User"), irAttribute()),
    ),
  ).toBe(false);
  expect(irBackground().equals(irBackground())).toBe(true);
  expect(irBackground().equals(irBackground({ op: "bool", value: false }))).toBe(false);
  expect(irObligation().equals(irObligation())).toBe(true);
  expect(irObligation().equals(irObligation({ op: "bool", value: false }))).toBe(false);
  expect(irScenario().equals(irScenario())).toBe(true);
  expect(irScenario().equals(irScenario(true))).toBe(false);
  expect(irScenarioWithBinding(true).equals(irScenarioWithBinding(true))).toBe(true);
  expect(irScenarioWithBinding(true).equals(irScenarioWithBinding(false))).toBe(false);
  expect(obligation().equals(obligation())).toBe(true);
  expect(obligation().equals(obligation({ op: "bool", value: false }))).toBe(false);
  expect(scenario().equals(scenario())).toBe(true);
  expect(scenario().equals(scenario("reject"))).toBe(false);
  expect(machineComponent().equals(machineComponent())).toBe(true);
  expect(machineComponent().equals(machineComponent({ op: "bool", value: false }))).toBe(false);
  expect(eventPairProbe().equals(eventPairProbe())).toBe(true);
  expect(eventPairProbe().equals(eventPairProbe("cancel"))).toBe(false);
  expect(queryEntry().equals(queryEntry())).toBe(true);
  expect(queryEntry().equals(queryEntry("unsat"))).toBe(false);
  expect(TraceState.of([traceEntry()]).equals(TraceState.of([traceEntry()]))).toBe(true);
  expect(TraceState.of([traceEntry()]).equals(TraceState.of([traceEntry(false)]))).toBe(false);
  expect(finding().equals(finding())).toBe(true);
  expect(finding().equals(finding("other"))).toBe(false);
  expect(skipped().equals(skipped())).toBe(true);
  expect(skipped().equals(skipped("capability"))).toBe(false);
  expect(report().equals(report())).toBe(true);
  expect(report().equals(report("other"))).toBe(false);
  expect(irEntity().equals(irEntity())).toBe(true);
  expect(irScenario().equals(irScenario())).toBe(true);
  expect(requirementAttribute().equals(requirementAttribute())).toBe(true);
  expect(requirementAttribute().equals(requirementAttribute("int"))).toBe(false);
});

test("bounded constructorはofで例外、parseでResultを返し、上限内は成功する", () => {
  expect(CrossCheckedEntries.parse([crossChecked()]).ok).toBe(true);
  expect(ObligationIdentifiers.parse([ObligationIdentifier.of("OB-1")]).ok).toBe(true);
  expect(QuintMachineComponents.parse([machineComponent()]).ok).toBe(true);
  expect(SatisfiabilityModuloTheoriesEventPairProbes.parse([eventPairProbe()]).ok).toBe(true);
  expect(TraceState.parse([traceEntry()]).ok).toBe(true);
  expect(TraceStates.parse([TraceState.of([traceEntry()])]).ok).toBe(true);
  expect(VerificationFindings.parse([finding()]).ok).toBe(true);
  expect(VerificationReports.parse([report()]).ok).toBe(true);
  expect(VerificationSkips.parse([skipped()]).ok).toBe(true);

  const claim = FunctionalRequirementReferenceClaim.of("OB-1", refs());
  const values = Array.from({ length: 65_536 }, () => claim);
  const tooMany = [...values, claim];
  expect(FunctionalRequirementReferenceClaims.parse(values).ok).toBe(true);
  expect(FunctionalRequirementReferenceIndex.parse(values).ok).toBe(true);
  expect(() => FunctionalRequirementReferenceClaims.of(tooMany)).toThrow();
  expect(FunctionalRequirementReferenceClaims.parse(tooMany).ok).toBe(false);
  expect(() => FunctionalRequirementReferenceIndex.of(tooMany)).toThrow();
  expect(FunctionalRequirementReferenceIndex.parse(tooMany).ok).toBe(false);

  const obligations = Array.from({ length: 65_536 }, () => obligation());
  expect(Obligations.parse(obligations).ok).toBe(true);
  expect(() => Obligations.of([...obligations, obligation()])).toThrow();
  expect(Obligations.parse([...obligations, obligation()]).ok).toBe(false);

  const entries = Array.from({ length: 65_536 }, () => queryEntry());
  expect(SatisfiabilityModuloTheoriesQueryVerdicts.parse(entries).ok).toBe(true);
  expect(() => SatisfiabilityModuloTheoriesQueryVerdicts.of([...entries, queryEntry()])).toThrow();
  expect(SatisfiabilityModuloTheoriesQueryVerdicts.parse([...entries, queryEntry()]).ok).toBe(false);
  expect(ImmutableFirstClassCollection.of([TargetIdentifier.of("OB-1")])).toBeInstanceOf(ImmutableFirstClassCollection);
});
