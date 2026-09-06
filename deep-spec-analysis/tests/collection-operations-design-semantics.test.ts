import { expect, test } from "bun:test";
import {
  AttributeMapping,
  AttributeMappings,
  AttributePaths,
  BusinessRuleReference,
  BusinessRuleReferenceIndex,
  BusinessRuleReferences,
  CheckedUnits,
  DesignAssignment,
  DesignAssignments,
  DesignAttributeCatalog,
  DesignAttributeCatalogEntry,
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignBackgroundAssumption,
  DesignBackgroundAssumptions,
  DesignBackgroundDeclaration,
  DesignBackgroundDeclarations,
  DesignBackgroundIdentifier,
  DesignCrossCheckedEntries,
  DesignCrossCheckedEntry,
  DesignEntityDeclaration,
  DesignEntityDeclarations,
  DesignEntityName,
  DesignEventRule,
  DesignEventRuleCatalog,
  DesignFinding,
  DesignFindings,
  DesignIgnore,
  DesignIgnoreDeclaration,
  DesignIgnoreDeclarations,
  DesignIgnores,
  DesignInputAnchor,
  DesignInputAnchors,
  DesignMachine,
  DesignMachineDeclaration,
  DesignMachineDeclarations,
  DesignMachineIdentifier,
  DesignMachines,
  DesignObligation,
  DesignObligationDeclaration,
  DesignObligationDeclarations,
  DesignObligationIdentifier,
  DesignObligationOrigin,
  DesignObligations,
  DesignReport,
  DesignReportIdentifier,
  DesignReports,
  DesignScenario,
  DesignScenarioDeclaration,
  DesignScenarioDeclarations,
  DesignScenarioIdentifier,
  DesignScenarios,
  DesignSkipped,
  DesignSkips,
  DesignTransition,
  DesignTransitionDeclaration,
  DesignTransitionDeclarations,
  DesignTransitionIdentifier,
  DesignTransitions,
  DesignUnit,
  DesignUnitDeclaration,
  DesignUnitDeclarations,
  DesignUnitIdentifier,
  DesignUnits,
  DesignWitness,
  EffectAssignment,
  EffectAssignments,
  EventMapping,
  EventMappings,
  InitialState,
  InitialStates,
  IssuedLoweredIdentifiers,
  LoweredBackground,
  LoweredBackgrounds,
  LoweredIdentifier,
  LoweredObligation,
  LoweredObligations,
  LoweredOrigin,
  LoweredOriginReference,
  LoweredScenario,
  LoweredScenarios,
  MachineReachability,
  ReachabilityPlan,
  RefinementAttribute,
  RefinementAttributes,
  RefinementObligation,
  RefinementObligations,
  RefinementQueryVerdict,
  RefinementQueryVerdictEntry,
  RefinementQueryVerdicts,
  RefinementQuintInvariant,
  RefinementQuintInvariants,
  RefinementScenario,
  RefinementScenarios,
  RefinementUnitMap,
  RefinementUnitMaps,
  RuleSubsumption,
  RuleSubsumptionProbe,
  RuleSubsumptions,
  RuleSubsumptionVerdict,
  SiblingVerdictFinding,
  SiblingVerdictFindings,
  SiblingVerdictSkip,
  SiblingVerdictSkips,
  TransitionReference,
  TransitionReferences,
  UnformalizedTargets,
  UnmappedDeclarations,
  UnmappedTarget,
  UnmappedTargetReference,
} from "@deep-spec-analysis/design-domain";
import {
  ArtifactPath,
  AttributeKind,
  AttributePath,
  BackendName,
  ContentHash,
  DeclaredBindings,
  ExpressionTree,
  FindingKind,
  FindingTargets,
  FunctionalRequirementReferences,
  ObligationNature,
  QueryLabel,
  RequirementIdentifier,
  ScenarioBindings,
  ScenarioExpectation,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
  UnitName,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import { ObligationIdentifier, ScenarioIdentifier } from "@deep-spec-analysis/requirements-domain";

const frRefs = FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]);
const brRefs = BusinessRuleReferences.of([]);
const bindings = ScenarioBindings.of([]);
const attr = DesignAttributeDeclaration.of({ name: DesignAttributeName.of("status"), kind: AttributeKind.of("bool") });
const attrs = DesignAttributeDeclarations.of([attr]);
const initial = InitialStates.of([InitialState.of("open")]);
const transitions = DesignTransitionDeclarations.of([]);
const ignores = DesignIgnoreDeclarations.of([]);
const trigger = TriggerName.of("submit");

test("designの値・宣言・実行要素は同値instanceと意味の異なるinstanceを区別する", () => {
  const expression = { op: "bool", value: true } as const;
  const bgA = DesignBackgroundAssumption.of({ id: DesignBackgroundIdentifier.of("DBG-1"), assert: expression });
  const bgB = DesignBackgroundAssumption.of({ id: DesignBackgroundIdentifier.of("DBG-1"), assert: expression });
  expect(bgA.equals(bgB)).toBe(true);
  expect(
    bgA.equals(
      DesignBackgroundAssumption.of({
        id: DesignBackgroundIdentifier.of("DBG-1"),
        assert: { op: "bool", value: false },
      }),
    ),
  ).toBe(false);

  const bgDeclA = DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-1"), assert: expression });
  const bgDeclB = DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-1"), assert: expression });
  expect(bgDeclA.equals(bgDeclB)).toBe(true);
  expect(bgDeclA.equals(DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-2") }))).toBe(false);

  const crossA = DesignCrossCheckedEntry.of({
    backend: BackendName.of("smt"),
    unit: UnitName.of("u1"),
    targets: targetIds("DSC-1"),
  });
  const crossB = DesignCrossCheckedEntry.of({
    backend: BackendName.of("smt"),
    unit: UnitName.of("u1"),
    targets: targetIds("DSC-1"),
  });
  expect(crossA.equals(crossB)).toBe(true);
  expect(
    crossA.equals(
      DesignCrossCheckedEntry.of({
        backend: BackendName.of("quint"),
        unit: UnitName.of("u1"),
        targets: targetIds("DSC-1"),
      }),
    ),
  ).toBe(false);

  const entityA = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Ticket"),
    description: "same",
    attributes: attrs,
  });
  const entityB = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Ticket"),
    description: "same",
    attributes: DesignAttributeDeclarations.of([
      DesignAttributeDeclaration.of({ name: DesignAttributeName.of("status"), kind: AttributeKind.of("bool") }),
    ]),
  });
  expect(entityA.equals(entityB)).toBe(true);
  expect(
    entityA.equals(
      DesignEntityDeclaration.of({ name: DesignEntityName.of("Ticket"), description: "different", attributes: attrs }),
    ),
  ).toBe(false);

  const ignoreA = DesignIgnore.of({ state: "open", trigger });
  expect(ignoreA.equals(DesignIgnore.of({ state: "open", trigger: TriggerName.of("submit") }))).toBe(true);
  expect(ignoreA.equals(DesignIgnore.of({ state: "closed", trigger }))).toBe(false);
  const ignoreDeclA = DesignIgnoreDeclaration.of({ state: "open", trigger });
  expect(ignoreDeclA.equals(DesignIgnoreDeclaration.of({ state: "open", trigger: TriggerName.of("submit") }))).toBe(
    true,
  );
  expect(ignoreDeclA.equals(DesignIgnoreDeclaration.of({ state: "closed", trigger }))).toBe(false);

  const inputA = DesignInputAnchor.of({ artifact: "model.md", sha256: ContentHash.ofText("same") });
  expect(inputA.equals(DesignInputAnchor.of({ artifact: "model.md", sha256: ContentHash.ofText("same") }))).toBe(true);
  expect(inputA.equals(DesignInputAnchor.of({ artifact: "other.md", sha256: ContentHash.ofText("same") }))).toBe(false);

  const machineDeclA = DesignMachineDeclaration.of({
    id: DesignMachineIdentifier.of("SM-1"),
    attrPath: "Ticket.status",
    initial,
    transitions,
    ignores,
  });
  expect(
    machineDeclA.equals(
      DesignMachineDeclaration.of({
        id: DesignMachineIdentifier.of("SM-1"),
        attrPath: "Ticket.status",
        initial: InitialStates.of([InitialState.of("open")]),
        transitions,
        ignores,
      }),
    ),
  ).toBe(true);
  expect(
    machineDeclA.equals(
      DesignMachineDeclaration.of({
        id: DesignMachineIdentifier.of("SM-1"),
        attrPath: "Ticket.other",
        initial,
        transitions,
        ignores,
      }),
    ),
  ).toBe(false);

  const machineA = DesignMachine.of({
    id: DesignMachineIdentifier.of("SM-1"),
    entity: DesignEntityName.of("Ticket"),
    attribute: DesignAttributeName.of("status"),
    initial,
    transitions: DesignTransitions.of([]),
    ignores: DesignIgnores.of([]),
    deterministic: true,
  });
  expect(
    machineA.equals(
      DesignMachine.of({
        id: DesignMachineIdentifier.of("SM-1"),
        entity: DesignEntityName.of("Ticket"),
        attribute: DesignAttributeName.of("status"),
        initial: InitialStates.of([InitialState.of("open")]),
        transitions: DesignTransitions.of([]),
        ignores: DesignIgnores.of([]),
        deterministic: true,
      }),
    ),
  ).toBe(true);
  expect(
    machineA.equals(
      DesignMachine.of({
        id: DesignMachineIdentifier.of("SM-1"),
        entity: DesignEntityName.of("Ticket"),
        attribute: DesignAttributeName.of("status"),
        initial,
        transitions: DesignTransitions.of([]),
        ignores: DesignIgnores.of([]),
        deterministic: false,
      }),
    ),
  ).toBe(false);

  const obligationDeclA = DesignObligationDeclaration.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    assert: expression,
  });
  expect(
    obligationDeclA.equals(
      DesignObligationDeclaration.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        assert: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(
    obligationDeclA.equals(
      DesignObligationDeclaration.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        assert: { op: "bool", value: false },
      }),
    ),
  ).toBe(false);

  const obligationA = DesignObligation.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    nature: ObligationNature.of("invariant"),
    origin: DesignObligationOrigin.of(""),
    businessRuleReferences: brRefs,
    functionalRequirementReferences: frRefs,
    assert: expression,
  });
  expect(
    obligationA.equals(
      DesignObligation.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        nature: ObligationNature.of("invariant"),
        origin: DesignObligationOrigin.of(""),
        businessRuleReferences: BusinessRuleReferences.of([]),
        functionalRequirementReferences: frRefs,
        assert: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(
    obligationA.equals(
      DesignObligation.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        nature: ObligationNature.of("event"),
        origin: DesignObligationOrigin.of(""),
        businessRuleReferences: brRefs,
        functionalRequirementReferences: frRefs,
      }),
    ),
  ).toBe(false);

  const scenarioDeclA = DesignScenarioDeclaration.of({
    id: DesignScenarioIdentifier.of("DSC-1"),
    bindings: DeclaredBindings.of([]),
    hasEvent: false,
    expect: expression,
  });
  expect(
    scenarioDeclA.equals(
      DesignScenarioDeclaration.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        bindings: DeclaredBindings.of([]),
        hasEvent: false,
        expect: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(
    scenarioDeclA.equals(
      DesignScenarioDeclaration.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        bindings: DeclaredBindings.of([]),
        hasEvent: true,
      }),
    ),
  ).toBe(false);

  const scenarioA = DesignScenario.of({
    id: DesignScenarioIdentifier.of("DSC-1"),
    expectation: ScenarioExpectation.of("accept"),
    businessRuleReferences: brRefs,
    functionalRequirementReferences: frRefs,
    bindings,
    expect: expression,
  });
  expect(
    scenarioA.equals(
      DesignScenario.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        expectation: ScenarioExpectation.of("accept"),
        businessRuleReferences: BusinessRuleReferences.of([]),
        functionalRequirementReferences: frRefs,
        bindings: ScenarioBindings.of([]),
        expect: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(
    scenarioA.equals(
      DesignScenario.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        expectation: ScenarioExpectation.of("reject"),
        businessRuleReferences: brRefs,
        functionalRequirementReferences: frRefs,
        bindings,
      }),
    ),
  ).toBe(false);

  const skippedA = DesignSkipped.of({
    target: TargetIdentifier.of("DSC-1"),
    reason: SkipReason.timeout(),
    unit: UnitName.of("u1"),
    detail: "x",
  });
  expect(
    skippedA.equals(
      DesignSkipped.of({
        target: TargetIdentifier.of("DSC-1"),
        reason: SkipReason.timeout(),
        unit: UnitName.of("u1"),
        detail: "x",
      }),
    ),
  ).toBe(true);
  expect(
    skippedA.equals(
      DesignSkipped.of({
        target: TargetIdentifier.of("DSC-1"),
        reason: SkipReason.unavailable(),
        unit: UnitName.of("u1"),
        detail: "x",
      }),
    ),
  ).toBe(false);

  const transitionDeclA = DesignTransitionDeclaration.of({
    id: DesignTransitionIdentifier.of("TR-1"),
    from: "open",
    to: "closed",
    trigger,
  });
  expect(
    transitionDeclA.equals(
      DesignTransitionDeclaration.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "open",
        to: "closed",
        trigger: TriggerName.of("submit"),
      }),
    ),
  ).toBe(true);
  expect(
    transitionDeclA.equals(
      DesignTransitionDeclaration.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "closed",
        to: "open",
        trigger,
      }),
    ),
  ).toBe(false);

  const transitionA = DesignTransition.of({
    id: DesignTransitionIdentifier.of("TR-1"),
    from: "open",
    to: "closed",
    trigger,
    businessRuleReferences: brRefs,
  });
  expect(
    transitionA.equals(
      DesignTransition.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "open",
        to: "closed",
        trigger: TriggerName.of("submit"),
        businessRuleReferences: BusinessRuleReferences.of([]),
      }),
    ),
  ).toBe(true);
  expect(
    transitionA.equals(
      DesignTransition.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "closed",
        to: "open",
        trigger,
        businessRuleReferences: brRefs,
      }),
    ),
  ).toBe(false);

  const reportA = DesignReport.irUnreadable(
    DesignReportIdentifier.of(ArtifactPath.of("verify"), "smt"),
    VerificationMethod.of("exhaustive"),
    "broken",
  );
  expect(
    reportA.equals(
      DesignReport.irUnreadable(
        DesignReportIdentifier.of(ArtifactPath.of("verify"), "smt"),
        VerificationMethod.of("exhaustive"),
        "other",
      ),
    ),
  ).toBe(true);
  expect(
    reportA.equals(
      DesignReport.irUnreadable(
        DesignReportIdentifier.of(ArtifactPath.of("other"), "smt"),
        VerificationMethod.of("exhaustive"),
        "broken",
      ),
    ),
  ).toBe(false);

  const effectA = EffectAssignment.of(
    AttributePath.of("Ticket.status"),
    ExpressionTree.of({
      op: "eq",
      args: [
        { op: "ref", path: "Ticket.status", prime: true },
        { op: "enum", value: "open" },
      ],
    }),
  );
  expect(
    effectA.equals(
      EffectAssignment.of(AttributePath.of("Ticket.status"), ExpressionTree.of(effectA.equation().asExpression())),
    ),
  ).toBe(true);
  const mappingA = EventMapping.of({ reqTrigger: trigger, transitions: TransitionReferences.of([]) });
  expect(
    mappingA.equals(
      EventMapping.of({ reqTrigger: TriggerName.of("submit"), transitions: TransitionReferences.of([]) }),
    ),
  ).toBe(true);
  expect(
    mappingA.equals(EventMapping.of({ reqTrigger: TriggerName.of("other"), transitions: TransitionReferences.of([]) })),
  ).toBe(false);

  const loweredBgA = LoweredBackground.of({ id: LoweredIdentifier.of("BG-1"), assert: expression });
  expect(
    loweredBgA.equals(LoweredBackground.of({ id: LoweredIdentifier.of("BG-1"), assert: { op: "bool", value: true } })),
  ).toBe(true);
  expect(
    loweredBgA.equals(LoweredBackground.of({ id: LoweredIdentifier.of("BG-1"), assert: { op: "bool", value: false } })),
  ).toBe(false);

  const origin = LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of("DOB-1") });
  const loweredObligationA = LoweredObligation.of({
    id: LoweredIdentifier.of("OB-1"),
    origin,
    nature: ObligationNature.of("invariant"),
    functionalRequirementReferences: frRefs,
    assert: expression,
  });
  expect(
    loweredObligationA.equals(
      LoweredObligation.of({
        id: LoweredIdentifier.of("OB-1"),
        origin: LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of("DOB-1") }),
        nature: ObligationNature.of("invariant"),
        functionalRequirementReferences: frRefs,
        assert: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(
    loweredObligationA.equals(
      LoweredObligation.of({
        id: LoweredIdentifier.of("OB-1"),
        origin: LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of("DOB-1") }),
        nature: ObligationNature.of("event"),
        functionalRequirementReferences: frRefs,
      }),
    ),
  ).toBe(false);

  const loweredScenarioA = LoweredScenario.of({
    id: LoweredIdentifier.of("SC-1"),
    origin: DesignScenarioIdentifier.of("DSC-1"),
    expectation: ScenarioExpectation.of("accept"),
    functionalRequirementReferences: frRefs,
    bindings,
  });
  expect(
    loweredScenarioA.equals(
      LoweredScenario.of({
        id: LoweredIdentifier.of("SC-1"),
        origin: DesignScenarioIdentifier.of("DSC-1"),
        expectation: ScenarioExpectation.of("accept"),
        functionalRequirementReferences: frRefs,
        bindings: ScenarioBindings.of([]),
      }),
    ),
  ).toBe(true);
  expect(
    loweredScenarioA.equals(
      LoweredScenario.of({
        id: LoweredIdentifier.of("SC-1"),
        origin: DesignScenarioIdentifier.of("DSC-1"),
        expectation: ScenarioExpectation.of("reject"),
        functionalRequirementReferences: frRefs,
        bindings,
      }),
    ),
  ).toBe(false);

  const refinementAttributeA = RefinementAttribute.of({ path: AttributePath.of("Ticket.status"), kind: "bool" });
  expect(
    refinementAttributeA.equals(RefinementAttribute.of({ path: AttributePath.of("Ticket.status"), kind: "bool" })),
  ).toBe(true);
  expect(
    refinementAttributeA.equals(RefinementAttribute.of({ path: AttributePath.of("Ticket.other"), kind: "bool" })),
  ).toBe(false);
  const refinementObligationA = RefinementObligation.of({
    id: ObligationIdentifier.of("OB-1"),
    nature: ObligationNature.of("invariant"),
    functionalRequirementReferences: frRefs,
    assert: expression,
  });
  expect(
    refinementObligationA.equals(
      RefinementObligation.of({
        id: ObligationIdentifier.of("OB-1"),
        nature: ObligationNature.of("invariant"),
        functionalRequirementReferences: frRefs,
        assert: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(
    refinementObligationA.equals(
      RefinementObligation.of({
        id: ObligationIdentifier.of("OB-1"),
        nature: ObligationNature.of("event"),
        functionalRequirementReferences: frRefs,
      }),
    ),
  ).toBe(false);
  const refinementScenarioA = RefinementScenario.of({
    id: ScenarioIdentifier.of("SC-1"),
    expectation: ScenarioExpectation.of("accept"),
    functionalRequirementReferences: frRefs,
    bindings,
  });
  expect(
    refinementScenarioA.equals(
      RefinementScenario.of({
        id: ScenarioIdentifier.of("SC-1"),
        expectation: ScenarioExpectation.of("accept"),
        functionalRequirementReferences: frRefs,
        bindings: ScenarioBindings.of([]),
      }),
    ),
  ).toBe(true);
  expect(
    refinementScenarioA.equals(
      RefinementScenario.of({
        id: ScenarioIdentifier.of("SC-1"),
        expectation: ScenarioExpectation.of("reject"),
        functionalRequirementReferences: frRefs,
        bindings,
      }),
    ),
  ).toBe(false);
  const verdictA = RefinementQueryVerdict.of({ status: "sat", decodedModel: { "Ticket.status": "open" } });
  expect(verdictA.equals(RefinementQueryVerdict.of({ status: "sat", decodedModel: { "Ticket.status": "open" } }))).toBe(
    true,
  );
  expect(
    verdictA.equals(RefinementQueryVerdict.of({ status: "sat", decodedModel: { "Ticket.status": "closed" } })),
  ).toBe(false);
  expect(verdictA.isSat()).toBe(true);
  expect(verdictA.isUnsat()).toBe(false);
  const invariantA = RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs, expression);
  expect(
    invariantA.equals(
      RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs, {
        op: "bool",
        value: true,
      }),
    ),
  ).toBe(true);
  expect(
    invariantA.equals(
      RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs, { op: "bool", value: false }),
    ),
  ).toBe(false);

  const unmappedA = UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "reason" });
  expect(unmappedA.equals(UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "reason" }))).toBe(
    true,
  );
  expect(unmappedA.equals(UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "other" }))).toBe(
    false,
  );
  const skipA = SiblingVerdictSkip.of({
    target: LoweredIdentifier.of("OB-1"),
    reason: SkipReason.timeout(),
    detail: "wait",
  });
  expect(
    skipA.equals(
      SiblingVerdictSkip.of({ target: LoweredIdentifier.of("OB-1"), reason: SkipReason.timeout(), detail: "wait" }),
    ),
  ).toBe(true);
  expect(
    skipA.equals(
      SiblingVerdictSkip.of({ target: LoweredIdentifier.of("OB-1"), reason: SkipReason.unavailable(), detail: "wait" }),
    ),
  ).toBe(false);
});

test("designの全FCCは公開factoryのparseとtail/filterを保ち、予算超過をResultへ変換する", () => {
  const expression = { op: "bool", value: true } as const;
  const path = AttributePath.of("Ticket.status");
  const mapping = AttributeMapping.of(path, { kind: "expression", expr: expression });
  const assignment = DesignAssignment.of(path, ExpressionTree.of({ op: "int", value: 1 }));
  const reference = BusinessRuleReference.of("BR1.1");
  const unitName = UnitName.of("u1");
  const entity = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Ticket"),
    attributes: DesignAttributeDeclarations.of([
      DesignAttributeDeclaration.of({ name: DesignAttributeName.of("status"), kind: AttributeKind.of("bool") }),
    ]),
  });
  const entities = DesignEntityDeclarations.of([entity]);
  const background = DesignBackgroundAssumption.of({
    id: DesignBackgroundIdentifier.of("DBG-1"),
    assert: expression,
  });
  const backgroundDeclaration = DesignBackgroundDeclaration.of({
    id: DesignBackgroundIdentifier.of("DBG-1"),
    assert: expression,
  });
  const ignore = DesignIgnore.of({ state: "open", trigger });
  const ignoreDeclaration = DesignIgnoreDeclaration.of({ state: "open", trigger });
  const input = DesignInputAnchor.of({ artifact: "model.md", sha256: ContentHash.ofText("same") });
  const initialState = InitialState.of("open");
  const machineDeclaration = DesignMachineDeclaration.of({
    id: DesignMachineIdentifier.of("SM-1"),
    attrPath: "Ticket.status",
    initial: InitialStates.of([initialState]),
    transitions: DesignTransitionDeclarations.of([]),
    ignores: DesignIgnoreDeclarations.of([ignoreDeclaration]),
  });
  const machine = DesignMachine.of({
    id: DesignMachineIdentifier.of("SM-1"),
    entity: DesignEntityName.of("Ticket"),
    attribute: DesignAttributeName.of("status"),
    initial: InitialStates.of([initialState]),
    transitions: DesignTransitions.of([]),
    ignores: DesignIgnores.of([ignore]),
    deterministic: true,
  });
  const obligationDeclaration = DesignObligationDeclaration.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    origin: DesignObligationOrigin.of("origin"),
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    assert: expression,
    guard: expression,
    effect: expression,
    temporal: { assert: expression, from: expression, to: expression },
  });
  const obligation = DesignObligation.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    nature: ObligationNature.of("invariant"),
    origin: DesignObligationOrigin.of("origin"),
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    functionalRequirementReferences: frRefs,
    assert: expression,
    guard: expression,
    effect: expression,
    temporal: { pattern: "always", assert: expression, from: expression, to: expression },
  });
  const report = DesignReport.irUnreadable(
    DesignReportIdentifier.of(ArtifactPath.of("verify"), "smt"),
    VerificationMethod.of("exhaustive"),
    "broken",
  );
  const scenarioDeclaration = DesignScenarioDeclaration.of({
    id: DesignScenarioIdentifier.of("DSC-1"),
    bindings: DeclaredBindings.of([]),
    hasEvent: false,
    expect: expression,
    businessRuleReferences: BusinessRuleReferences.of([reference]),
  });
  const scenario = DesignScenario.of({
    id: DesignScenarioIdentifier.of("DSC-1"),
    expectation: ScenarioExpectation.of("accept"),
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    functionalRequirementReferences: frRefs,
    bindings,
    expect: expression,
    event: { trigger },
  });
  const skipped = DesignSkipped.of({
    target: TargetIdentifier.of("DSC-1"),
    reason: SkipReason.timeout(),
    unit: unitName,
    detail: "wait",
  });
  const transitionDeclaration = DesignTransitionDeclaration.of({
    id: DesignTransitionIdentifier.of("TR-1"),
    from: "open",
    to: "closed",
    trigger,
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    guard: expression,
    effect: expression,
  });
  const transition = DesignTransition.of({
    id: DesignTransitionIdentifier.of("TR-1"),
    from: "open",
    to: "closed",
    trigger,
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    guard: expression,
    effect: expression,
  });
  const unit = DesignUnit.of({
    unit: unitName,
    catalog: DesignAttributeCatalog.of(entities),
    obligations: DesignObligations.of([]),
    machines: DesignMachines.of([]),
    scenarios: DesignScenarios.of([]),
    background: DesignBackgroundAssumptions.of([]),
  });
  const unitDeclaration = DesignUnitDeclaration.of({
    unit: DesignUnitIdentifier.of("u1"),
    entities,
    obligations: DesignObligationDeclarations.of([obligationDeclaration]),
    stateMachines: DesignMachineDeclarations.of([machineDeclaration]),
    scenarios: DesignScenarioDeclarations.of([scenarioDeclaration]),
    background: DesignBackgroundDeclarations.of([backgroundDeclaration]),
    unformalizedTargets: UnformalizedTargets.of([]),
    directoryExists: true,
    rules: BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([reference])),
  });
  const loweredBackground = LoweredBackground.of({ id: LoweredIdentifier.of("BG-1"), assert: expression });
  const loweredObligation = LoweredObligation.of({
    id: LoweredIdentifier.of("OB-1"),
    origin: LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of("DOB-1") }),
    nature: ObligationNature.of("invariant"),
    functionalRequirementReferences: frRefs,
    assert: expression,
    trigger,
    guard: expression,
    effect: expression,
    temporal: { pattern: "always", assert: expression, from: expression, to: expression },
  });
  const loweredScenario = LoweredScenario.of({
    id: LoweredIdentifier.of("SC-1"),
    origin: DesignScenarioIdentifier.of("DSC-1"),
    expectation: ScenarioExpectation.of("accept"),
    functionalRequirementReferences: frRefs,
    bindings,
  });
  const refinementAttribute = RefinementAttribute.of({ path, kind: "bool" });
  const refinementObligation = RefinementObligation.of({
    id: ObligationIdentifier.of("OB-1"),
    nature: ObligationNature.of("invariant"),
    functionalRequirementReferences: frRefs,
    assert: expression,
  });
  const queryVerdict = RefinementQueryVerdict.of({ status: "sat", decodedModel: { "Ticket.status": "open" } });
  const queryEntry = RefinementQueryVerdictEntry.of(QueryLabel.of("q1"), queryVerdict);
  const quintInvariant = RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs, expression);
  const refinementScenario = RefinementScenario.of({
    id: ScenarioIdentifier.of("SC-1"),
    expectation: ScenarioExpectation.of("accept"),
    functionalRequirementReferences: frRefs,
    bindings,
  });
  const refinementMap = RefinementUnitMap.of({
    unit: DesignUnitIdentifier.of("u1"),
    attrMap: AttributeMappings.of([mapping]),
    eventMap: EventMappings.of([]),
    unmapped: UnmappedDeclarations.of([]),
  });
  const eventA = DesignEventRule.of({
    reference: DesignObligationIdentifier.of("DOB-1"),
    trigger,
    guard: expression,
    effect: { op: "bool", value: true },
  });
  const eventB = DesignEventRule.of({
    reference: DesignObligationIdentifier.of("DOB-2"),
    trigger,
    guard: expression,
    effect: { op: "bool", value: true },
  });
  const relation = RuleSubsumption.of(
    RuleSubsumptionVerdict.fromFinding(
      RuleSubsumptionProbe.of({ subsumer: eventA, subsumed: eventB }),
      SiblingVerdictFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: frRefs,
        targets: [LoweredIdentifier.of("OB-1")],
        witness: DesignWitness.core([]),
        detail: "evidence",
      }),
      DesignWitness.core([]),
      unitName,
    ),
  );
  const finding = DesignFinding.of({
    kind: FindingKind.conflict(),
    functionalRequirementReferences: frRefs,
    targets: FindingTargets.of(TargetIdentifier.of("OB-1"), []),
    witness: DesignWitness.core([]),
    unit: unitName,
    detail: "conflict",
  });
  const siblingFinding = SiblingVerdictFinding.of({
    kind: FindingKind.conflict(),
    functionalRequirementReferences: frRefs,
    targets: [LoweredIdentifier.of("OB-1")],
    witness: DesignWitness.core([]),
    detail: "conflict",
  });
  const siblingSkip = SiblingVerdictSkip.of({ target: LoweredIdentifier.of("OB-1"), reason: SkipReason.timeout() });
  const reachability = MachineReachability.of({
    unit,
    machine,
    probes: [],
    bounded: true,
    observations: new Map(),
  });

  const secondAttribute = DesignAttributeDeclaration.of({
    name: DesignAttributeName.of("priority"),
    kind: AttributeKind.of("int"),
  });
  const entityWithTwoAttributes = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Ticket"),
    attributes: DesignAttributeDeclarations.of([entity.attributes().head(), secondAttribute]),
  });
  const entityWithReversedAttributes = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Ticket"),
    attributes: DesignAttributeDeclarations.of([secondAttribute, entity.attributes().head()]),
  });
  expect(entityWithTwoAttributes.equals(entityWithReversedAttributes)).toBe(false);

  const orderedCrossChecked = (targets: readonly TargetIdentifier[]) =>
    DesignCrossCheckedEntry.of({
      backend: BackendName.of("smt"),
      unit: unitName,
      targets: TargetIdentifiers.of(targets),
    });
  expect(
    orderedCrossChecked([TargetIdentifier.of("DSC-1"), TargetIdentifier.of("DSC-2")]).equals(
      orderedCrossChecked([TargetIdentifier.of("DSC-2"), TargetIdentifier.of("DSC-1")]),
    ),
  ).toBe(false);

  const orderedTransitions = (values: readonly string[]) =>
    EventMapping.of({
      reqTrigger: trigger,
      transitions: TransitionReferences.of(values.map((value) => TransitionReference.of(value))),
    });
  expect(orderedTransitions(["TR-1", "TR-2"]).equals(orderedTransitions(["TR-2", "TR-1"]))).toBe(false);

  const orderedFinding = (targets: readonly string[]) =>
    DesignFinding.of({
      kind: FindingKind.conflict(),
      functionalRequirementReferences: frRefs,
      targets: FindingTargets.of(
        TargetIdentifier.of(targets[0] ?? "OB-1"),
        targets.slice(1).map((target) => TargetIdentifier.of(target)),
      ),
      witness: DesignWitness.core([]),
      unit: unitName,
      detail: "conflict",
    });
  expect(orderedFinding(["OB-1", "OB-2"]).equals(orderedFinding(["OB-2", "OB-1"]))).toBe(false);

  const orderedSiblingFinding = (targets: readonly string[]) =>
    SiblingVerdictFinding.of({
      kind: FindingKind.conflict(),
      functionalRequirementReferences: frRefs,
      targets: targets.map((target) => LoweredIdentifier.of(target)),
      witness: DesignWitness.core([]),
      detail: "conflict",
    });
  expect(orderedSiblingFinding(["OB-1", "OB-2"]).equals(orderedSiblingFinding(["OB-2", "OB-1"]))).toBe(false);

  const equivalentUnit = DesignUnit.of({
    unit: UnitName.of("u1"),
    catalog: DesignAttributeCatalog.of(entities),
    obligations: DesignObligations.of([]),
    machines: DesignMachines.of([]),
    scenarios: DesignScenarios.of([]),
    background: DesignBackgroundAssumptions.of([]),
  });
  expect(unit.equals(equivalentUnit)).toBe(true);
  expect(
    unit.equals(
      DesignUnit.of({
        unit: UnitName.of("u2"),
        catalog: DesignAttributeCatalog.of(entities),
        obligations: DesignObligations.of([]),
        machines: DesignMachines.of([]),
        scenarios: DesignScenarios.of([]),
        background: DesignBackgroundAssumptions.of([]),
      }),
    ),
  ).toBe(false);
  const equivalentUnitDeclaration = DesignUnitDeclaration.of({
    unit: DesignUnitIdentifier.of("u1"),
    entities,
    obligations: DesignObligationDeclarations.of([obligationDeclaration]),
    stateMachines: DesignMachineDeclarations.of([machineDeclaration]),
    scenarios: DesignScenarioDeclarations.of([scenarioDeclaration]),
    background: DesignBackgroundDeclarations.of([backgroundDeclaration]),
    unformalizedTargets: UnformalizedTargets.of([]),
    directoryExists: true,
    rules: BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([reference])),
  });
  expect(unitDeclaration.equals(equivalentUnitDeclaration)).toBe(true);
  expect(
    unitDeclaration.equals(
      DesignUnitDeclaration.of({
        unit: DesignUnitIdentifier.of("u1"),
        entities,
        obligations: DesignObligationDeclarations.of([obligationDeclaration]),
        stateMachines: DesignMachineDeclarations.of([machineDeclaration]),
        scenarios: DesignScenarioDeclarations.of([scenarioDeclaration]),
        background: DesignBackgroundDeclarations.of([backgroundDeclaration]),
        unformalizedTargets: UnformalizedTargets.of([]),
        directoryExists: false,
        rules: BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([reference])),
      }),
    ),
  ).toBe(false);
  expect(
    scenarioDeclaration.equals(
      DesignScenarioDeclaration.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        bindings: DeclaredBindings.of([]),
        hasEvent: false,
        expect: expression,
        businessRuleReferences: BusinessRuleReferences.of([reference]),
      }),
    ),
  ).toBe(true);
  expect(
    scenario.equals(
      DesignScenario.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        expectation: ScenarioExpectation.of("accept"),
        businessRuleReferences: BusinessRuleReferences.of([reference]),
        functionalRequirementReferences: frRefs,
        bindings,
        expect: expression,
        event: { trigger },
      }),
    ),
  ).toBe(true);
  expect(
    scenario.equals(
      DesignScenario.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        expectation: ScenarioExpectation.of("accept"),
        businessRuleReferences: BusinessRuleReferences.of([reference]),
        functionalRequirementReferences: frRefs,
        bindings,
        event: { trigger: TriggerName.of("other") },
      }),
    ),
  ).toBe(false);
  expect(
    transitionDeclaration.equals(
      DesignTransitionDeclaration.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "open",
        to: "closed",
        trigger,
        businessRuleReferences: BusinessRuleReferences.of([reference]),
        guard: expression,
        effect: expression,
      }),
    ),
  ).toBe(true);
  expect(
    transitionDeclaration.equals(
      DesignTransitionDeclaration.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "closed",
        to: "open",
        trigger,
        businessRuleReferences: BusinessRuleReferences.of([reference]),
        guard: expression,
        effect: expression,
      }),
    ),
  ).toBe(false);
  expect(finding.equals(finding)).toBe(true);
  expect(finding.equals(finding.withDetail("other"))).toBe(false);
  expect(siblingFinding.equals(siblingFinding)).toBe(true);
  expect(siblingFinding.equals(orderedSiblingFinding(["OB-1"]))).toBe(true);
  expect(relation.equals(relation)).toBe(true);
  const equivalentObligationDeclaration = DesignObligationDeclaration.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    origin: DesignObligationOrigin.of("origin"),
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    assert: expression,
    guard: expression,
    effect: expression,
    temporal: { assert: expression, from: expression, to: expression },
  });
  expect(obligationDeclaration.equals(equivalentObligationDeclaration)).toBe(true);
  expect(
    obligationDeclaration.equals(
      DesignObligationDeclaration.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        origin: DesignObligationOrigin.of("origin"),
        businessRuleReferences: BusinessRuleReferences.of([reference]),
        assert: expression,
        guard: expression,
        effect: expression,
        temporal: { assert: expression, from: expression, to: { op: "bool", value: false } },
      }),
    ),
  ).toBe(false);
  const equivalentObligation = DesignObligation.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    nature: ObligationNature.of("invariant"),
    origin: DesignObligationOrigin.of("origin"),
    businessRuleReferences: BusinessRuleReferences.of([reference]),
    functionalRequirementReferences: frRefs,
    assert: expression,
    guard: expression,
    effect: expression,
    temporal: { pattern: "always", assert: expression, from: expression, to: expression },
  });
  expect(obligation.equals(equivalentObligation)).toBe(true);
  expect(
    obligation.equals(
      DesignObligation.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        nature: ObligationNature.of("invariant"),
        origin: DesignObligationOrigin.of("origin"),
        businessRuleReferences: BusinessRuleReferences.of([reference]),
        functionalRequirementReferences: frRefs,
        assert: expression,
        guard: expression,
        effect: expression,
        temporal: { pattern: "eventually", assert: expression, from: expression, to: expression },
      }),
    ),
  ).toBe(false);
  expect(
    loweredObligation.equals(
      LoweredObligation.of({
        id: LoweredIdentifier.of("OB-1"),
        origin: LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of("DOB-1") }),
        nature: ObligationNature.of("invariant"),
        functionalRequirementReferences: frRefs,
        assert: expression,
        trigger,
        guard: expression,
        effect: expression,
        temporal: { pattern: "always", assert: expression, from: expression, to: expression },
      }),
    ),
  ).toBe(true);
  expect(
    loweredObligation.equals(
      LoweredObligation.of({
        id: LoweredIdentifier.of("OB-1"),
        origin: LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of("DOB-1") }),
        nature: ObligationNature.of("invariant"),
        functionalRequirementReferences: frRefs,
        assert: expression,
        trigger,
        guard: expression,
        effect: expression,
        temporal: { pattern: "eventually", assert: expression, from: expression, to: expression },
      }),
    ),
  ).toBe(false);
  const equivalentRelation = RuleSubsumption.of(
    RuleSubsumptionVerdict.fromFinding(
      RuleSubsumptionProbe.of({
        subsumer: DesignEventRule.of({
          reference: DesignObligationIdentifier.of("DOB-1"),
          trigger,
          guard: expression,
          effect: { op: "bool", value: true },
        }),
        subsumed: DesignEventRule.of({
          reference: DesignObligationIdentifier.of("DOB-2"),
          trigger,
          guard: expression,
          effect: { op: "bool", value: true },
        }),
      }),
      SiblingVerdictFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: frRefs,
        targets: [LoweredIdentifier.of("OB-1")],
        witness: DesignWitness.core([]),
        detail: "evidence",
      }),
      DesignWitness.core([]),
      unitName,
    ),
  );
  expect(relation.equals(equivalentRelation)).toBe(true);
  const differentRelation = RuleSubsumption.of(
    RuleSubsumptionVerdict.fromFinding(
      RuleSubsumptionProbe.of({ subsumer: eventB, subsumed: eventA }),
      SiblingVerdictFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: frRefs,
        targets: [LoweredIdentifier.of("OB-1")],
        witness: DesignWitness.core([]),
        detail: "different evidence",
      }),
      DesignWitness.core([]),
      unitName,
    ),
  );
  expect(relation.equals(differentRelation)).toBe(false);

  exerciseArrayCollection("AttributeMappings", mapping, AttributeMappings.of, AttributeMappings.parse);
  exerciseArrayCollection("AttributePaths", path, AttributePaths.of, AttributePaths.parse);
  exerciseArrayCollection(
    "BusinessRuleReferences",
    reference,
    BusinessRuleReferences.of,
    BusinessRuleReferences.parse,
    10_000,
  );
  exerciseArrayCollection("CheckedUnits", unitName, CheckedUnits.of, CheckedUnits.parse);
  exerciseArrayCollection("DesignAssignments", assignment, DesignAssignments.of, DesignAssignments.parse, 10_000);
  exerciseArrayCollection(
    "DesignAttributeDeclarations",
    entity.attributes().head(),
    DesignAttributeDeclarations.of,
    DesignAttributeDeclarations.parse,
  );
  exerciseArrayCollection(
    "DesignBackgroundAssumptions",
    background,
    DesignBackgroundAssumptions.of,
    DesignBackgroundAssumptions.parse,
  );
  exerciseArrayCollection(
    "DesignBackgroundDeclarations",
    backgroundDeclaration,
    DesignBackgroundDeclarations.of,
    DesignBackgroundDeclarations.parse,
  );
  exerciseArrayCollection(
    "DesignCrossCheckedEntries",
    DesignCrossCheckedEntry.of({
      backend: BackendName.of("smt"),
      unit: unitName,
      targets: TargetIdentifiers.of([TargetIdentifier.of("DSC-1")]),
    }),
    DesignCrossCheckedEntries.of,
    DesignCrossCheckedEntries.parse,
  );
  exerciseArrayCollection(
    "DesignEntityDeclarations",
    entity,
    DesignEntityDeclarations.of,
    DesignEntityDeclarations.parse,
  );
  exerciseArrayCollection("DesignFindings", finding, DesignFindings.of, DesignFindings.parse);
  exerciseArrayCollection(
    "DesignIgnoreDeclarations",
    ignoreDeclaration,
    DesignIgnoreDeclarations.of,
    DesignIgnoreDeclarations.parse,
  );
  exerciseArrayCollection("DesignIgnores", ignore, DesignIgnores.of, DesignIgnores.parse);
  exerciseArrayCollection("DesignInputAnchors", input, DesignInputAnchors.of, DesignInputAnchors.parse);
  exerciseArrayCollection(
    "DesignMachineDeclarations",
    machineDeclaration,
    DesignMachineDeclarations.of,
    DesignMachineDeclarations.parse,
  );
  exerciseArrayCollection("DesignMachines", machine, DesignMachines.of, DesignMachines.parse);
  exerciseArrayCollection(
    "DesignObligationDeclarations",
    obligationDeclaration,
    DesignObligationDeclarations.of,
    DesignObligationDeclarations.parse,
  );
  exerciseArrayCollection("DesignObligations", obligation, DesignObligations.of, DesignObligations.parse);
  exerciseArrayCollection("DesignReports", report, DesignReports.of, DesignReports.parse);
  exerciseArrayCollection(
    "DesignScenarioDeclarations",
    scenarioDeclaration,
    DesignScenarioDeclarations.of,
    DesignScenarioDeclarations.parse,
  );
  exerciseArrayCollection("DesignScenarios", scenario, DesignScenarios.of, DesignScenarios.parse);
  exerciseArrayCollection("DesignSkips", skipped, DesignSkips.of, DesignSkips.parse);
  exerciseArrayCollection(
    "DesignTransitionDeclarations",
    transitionDeclaration,
    DesignTransitionDeclarations.of,
    DesignTransitionDeclarations.parse,
  );
  exerciseArrayCollection("DesignTransitions", transition, DesignTransitions.of, DesignTransitions.parse);
  exerciseArrayCollection(
    "DesignUnitDeclarations",
    unitDeclaration,
    DesignUnitDeclarations.of,
    DesignUnitDeclarations.parse,
  );
  exerciseArrayCollection("DesignUnits", unit, DesignUnits.of, DesignUnits.parse);
  exerciseArrayCollection(
    "EffectAssignments",
    effectAssignmentFixture(path),
    EffectAssignments.of,
    EffectAssignments.parse,
    10_000,
  );
  exerciseArrayCollection(
    "EventMappings",
    EventMapping.of({ reqTrigger: trigger, transitions: TransitionReferences.of([]) }),
    EventMappings.of,
    EventMappings.parse,
  );
  exerciseArrayCollection("InitialStates", initialState, InitialStates.of, InitialStates.parse, 10_000);
  exerciseArrayCollection(
    "IssuedLoweredIdentifiers",
    LoweredIdentifier.of("OB-1"),
    IssuedLoweredIdentifiers.of,
    IssuedLoweredIdentifiers.parse,
  );
  exerciseArrayCollection("LoweredBackgrounds", loweredBackground, LoweredBackgrounds.of, LoweredBackgrounds.parse);
  exerciseArrayCollection("LoweredObligations", loweredObligation, LoweredObligations.of, LoweredObligations.parse);
  exerciseArrayCollection("LoweredScenarios", loweredScenario, LoweredScenarios.of, LoweredScenarios.parse);
  exerciseArrayCollection(
    "RefinementAttributes",
    refinementAttribute,
    RefinementAttributes.of,
    RefinementAttributes.parse,
  );
  exerciseArrayCollection(
    "RefinementObligations",
    refinementObligation,
    RefinementObligations.of,
    RefinementObligations.parse,
  );
  exerciseArrayCollection(
    "RefinementQueryVerdicts",
    queryEntry,
    RefinementQueryVerdicts.of,
    RefinementQueryVerdicts.parse,
  );
  exerciseArrayCollection(
    "RefinementQuintInvariants",
    quintInvariant,
    RefinementQuintInvariants.of,
    RefinementQuintInvariants.parse,
  );
  exerciseArrayCollection("RefinementScenarios", refinementScenario, RefinementScenarios.of, RefinementScenarios.parse);
  exerciseArrayCollection("RefinementUnitMaps", refinementMap, RefinementUnitMaps.of, RefinementUnitMaps.parse);
  exerciseArrayCollection("RuleSubsumptions", relation, RuleSubsumptions.of, RuleSubsumptions.parse);
  exerciseArrayCollection(
    "SiblingVerdictFindings",
    siblingFinding,
    SiblingVerdictFindings.of,
    SiblingVerdictFindings.parse,
  );
  exerciseArrayCollection("SiblingVerdictSkips", siblingSkip, SiblingVerdictSkips.of, SiblingVerdictSkips.parse);
  exerciseArrayCollection(
    "TransitionReferences",
    TransitionReference.of("TR-1"),
    TransitionReferences.of,
    TransitionReferences.parse,
  );
  exerciseArrayCollection(
    "UnformalizedTargets",
    TargetIdentifier.of("OB-1"),
    UnformalizedTargets.of,
    UnformalizedTargets.parse,
  );
  exerciseArrayCollection(
    "UnmappedDeclarations",
    UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "reason" }),
    UnmappedDeclarations.of,
    UnmappedDeclarations.parse,
  );

  const catalog = DesignAttributeCatalog.of(entities);
  expect([...catalog.tail()].map((entry) => entry.path().asString())).toEqual([]);
  expect([...catalog.filter(() => true)].map((entry) => entry.attribute().equals(entity.attributes().head()))).toEqual([
    true,
  ]);
  expect(DesignAttributeCatalog.parse(entities).ok).toBe(true);
  const catalogEntry = DesignAttributeCatalogEntry.of(DesignEntityName.of("Ticket"), entity.attributes().head());
  expect(
    catalogEntry.equals(DesignAttributeCatalogEntry.of(DesignEntityName.of("Ticket"), entity.attributes().head())),
  ).toBe(true);
  expect(
    catalogEntry.equals(DesignAttributeCatalogEntry.of(DesignEntityName.of("Other"), entity.attributes().head())),
  ).toBe(false);

  const index = BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([reference]));
  expect(index.tail().isEmpty()).toBe(true);
  expect(index.filter((candidate) => candidate.equals(reference)).isEmpty()).toBe(false);
  expect(BusinessRuleReferenceIndex.parse(BusinessRuleReferences.of([reference])).ok).toBe(true);

  const eventUnit = DesignUnit.of({
    unit: unitName,
    catalog: DesignAttributeCatalog.of(entities),
    obligations: DesignObligations.of([
      DesignObligation.of({
        id: DesignObligationIdentifier.of("DOB-3"),
        nature: ObligationNature.of("event"),
        origin: DesignObligationOrigin.of("origin"),
        businessRuleReferences: BusinessRuleReferences.of([]),
        functionalRequirementReferences: frRefs,
        trigger,
        guard: expression,
        effect: {
          op: "eq",
          args: [
            { op: "ref", path: "Ticket.status", prime: true },
            { op: "enum", value: "open" },
          ],
        },
      }),
    ]),
    machines: DesignMachines.of([]),
    scenarios: DesignScenarios.of([]),
    background: DesignBackgroundAssumptions.of([]),
  });
  const eventCatalog = DesignEventRuleCatalog.of(eventUnit);
  expect(eventCatalog.tail().isEmpty()).toBe(true);
  expect(eventCatalog.filter(() => true).isEmpty()).toBe(false);
  expect(DesignEventRuleCatalog.parse(eventUnit).ok).toBe(true);
  expect(
    eventA.equals(
      DesignEventRule.of({
        reference: DesignObligationIdentifier.of("DOB-1"),
        trigger,
        guard: expression,
        effect: { op: "bool", value: true },
      }),
    ),
  ).toBe(true);
  expect(eventA.equals(eventB)).toBe(false);

  const reachabilityPlan = ReachabilityPlan.of([reachability]);
  expect(reachabilityPlan.tail().isEmpty()).toBe(true);
  expect(reachabilityPlan.filter(() => true).isEmpty()).toBe(false);
  expect(ReachabilityPlan.parse([reachability]).ok).toBe(true);
});

function exerciseArrayCollection<E>(
  name: string,
  value: E,
  make: (values: readonly E[]) => {
    tail(): { isEmpty(): boolean };
    filter(predicate: (element: E) => boolean): { [Symbol.iterator](): Iterator<E> };
  },
  parse: (values: readonly E[]) => Result<unknown, ParseError>,
  maximum = 65_536,
): void {
  const values = [value];
  const collection = make(values);
  expect([...collection.filter(() => true)], name).toHaveLength(1);
  expect(collection.tail().isEmpty(), name).toBe(true);
  expect(parse(values).ok, name).toBe(true);
  const tooMany = Array.from({ length: maximum + 1 }, () => value);
  expect(() => make(tooMany), name).toThrow(IllegalArgumentException);
  const parsed = parse(tooMany);
  expect(parsed.ok, name).toBe(false);
  if (!parsed.ok) expect(parsed.error, name).not.toBeInstanceOf(Error);
}

function effectAssignmentFixture(path: AttributePath): EffectAssignment {
  return EffectAssignment.of(
    path,
    ExpressionTree.of({
      op: "eq",
      args: [
        { op: "ref", path: path.asString(), prime: true },
        { op: "enum", value: "open" },
      ],
    }),
  );
}

function targetIds(...ids: string[]) {
  const [head, ...tail] = ids.map((id) => TargetIdentifier.of(id));
  if (head === undefined) throw new Error("targetIds requires a head");
  return TargetIdentifiers.of([head, ...tail]);
}
