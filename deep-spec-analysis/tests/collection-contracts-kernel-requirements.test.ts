import { describe, expect, test } from "bun:test";
import type { Equatable } from "@deep-spec-analysis/kernel-domain";
import {
  ArtifactPath,
  AttributeKind,
  AttributePath,
  BackendName,
  BindingDeclaration,
  BindingValue,
  ContentHash,
  Declaration,
  DeclaredBindingValue,
  EnumerationMember,
  ErrorMessage,
  type FallibleFirstClassCollectionFactory,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  type FirstClassCollectionFactory,
  IntermediateRepresentationVersion,
  KeyedIndex,
  KeySet,
  type NonEmptyFirstClassCollectionFactory,
  ObligationNature,
  QueryLabel,
  RequirementIdentifier,
  ScenarioBinding,
  ScenarioExpectation,
  ScenarioVerdict,
  SkipReason,
  TargetIdentifier,
  TriggerName,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import {
  FormalModelIdentifier,
  QuintCheckResult,
  QuintMachinePlan,
  QuintMachineRunVerdict,
  QuintRuns,
  RequirementsModel,
  SatisfiabilityModuloTheoriesCheck,
  SatisfiabilityModuloTheoriesQueryVerdict,
  SatisfiabilityModuloTheoriesQueryVerdictEntry,
  SatisfiabilityModuloTheoriesVerificationPlan,
  TraceStateEntry,
  VerificationReportIdentifier,
} from "@deep-spec-analysis/requirements-domain";
import { DeclaredBindings } from "../src/kernel/domain/declared-bindings.ts";
import { EnumerationMembers } from "../src/kernel/domain/enumeration-members.ts";
import { ErrorMessages } from "../src/kernel/domain/error-messages.ts";
import { FunctionalRequirementReferences } from "../src/kernel/domain/functional-requirement-references.ts";
import { RequirementIdentifiers } from "../src/kernel/domain/requirement-identifiers.ts";
import { ScenarioBindings } from "../src/kernel/domain/scenario-bindings.ts";
import { ScenarioVerdicts } from "../src/kernel/domain/scenario-verdicts.ts";
import { TargetIdentifiers } from "../src/kernel/domain/target-identifiers.ts";
import { BackgroundAssumption } from "../src/requirements/domain/background-assumption.ts";
import { BackgroundAssumptionIdentifier } from "../src/requirements/domain/background-assumption-identifier.ts";
import { BackgroundAssumptions } from "../src/requirements/domain/background-assumptions.ts";
import { CrossCheckedEntries } from "../src/requirements/domain/cross-checked-entries.ts";
import { CrossCheckedEntry } from "../src/requirements/domain/cross-checked-entry.ts";
import { FunctionalRequirementReferenceClaim } from "../src/requirements/domain/functional-requirement-reference-claim.ts";
import { FunctionalRequirementReferenceClaims } from "../src/requirements/domain/functional-requirement-reference-claims.ts";
import { FunctionalRequirementReferenceIndex } from "../src/requirements/domain/functional-requirement-reference-index.ts";
import { IntermediateRepresentationAttributeCatalog } from "../src/requirements/domain/intermediate-representation-attribute-catalog.ts";
import { IntermediateRepresentationAttributeDeclaration } from "../src/requirements/domain/intermediate-representation-attribute-declaration.ts";
import { IntermediateRepresentationAttributeDeclarations } from "../src/requirements/domain/intermediate-representation-attribute-declarations.ts";
import { IntermediateRepresentationAttributeName } from "../src/requirements/domain/intermediate-representation-attribute-name.ts";
import { IntermediateRepresentationBackgroundDeclaration } from "../src/requirements/domain/intermediate-representation-background-declaration.ts";
import { IntermediateRepresentationBackgroundDeclarations } from "../src/requirements/domain/intermediate-representation-background-declarations.ts";
import { IntermediateRepresentationEntityDeclaration } from "../src/requirements/domain/intermediate-representation-entity-declaration.ts";
import { IntermediateRepresentationEntityDeclarations } from "../src/requirements/domain/intermediate-representation-entity-declarations.ts";
import { IntermediateRepresentationEntityName } from "../src/requirements/domain/intermediate-representation-entity-name.ts";
import { IntermediateRepresentationObligationDeclaration } from "../src/requirements/domain/intermediate-representation-obligation-declaration.ts";
import { IntermediateRepresentationObligationDeclarations } from "../src/requirements/domain/intermediate-representation-obligation-declarations.ts";
import { IntermediateRepresentationScenarioDeclaration } from "../src/requirements/domain/intermediate-representation-scenario-declaration.ts";
import { IntermediateRepresentationScenarioDeclarations } from "../src/requirements/domain/intermediate-representation-scenario-declarations.ts";
import { Obligation } from "../src/requirements/domain/obligation.ts";
import { ObligationIdentifier } from "../src/requirements/domain/obligation-identifier.ts";
import { ObligationIdentifiers } from "../src/requirements/domain/obligation-identifiers.ts";
import { Obligations } from "../src/requirements/domain/obligations.ts";
import { QuintMachineComponent } from "../src/requirements/domain/quint-machine-component.ts";
import { QuintMachineComponents } from "../src/requirements/domain/quint-machine-components.ts";
import { RequirementAttributeDeclaration } from "../src/requirements/domain/requirement-attribute-declaration.ts";
import { RequirementAttributeDeclarations } from "../src/requirements/domain/requirement-attribute-declarations.ts";
import { SatisfiabilityModuloTheoriesEventPairProbe } from "../src/requirements/domain/satisfiability-modulo-theories-event-pair-probe.ts";
import { SatisfiabilityModuloTheoriesEventPairProbes } from "../src/requirements/domain/satisfiability-modulo-theories-event-pair-probes.ts";
import { SatisfiabilityModuloTheoriesProbe } from "../src/requirements/domain/satisfiability-modulo-theories-probe.ts";
import { SatisfiabilityModuloTheoriesQueryVerdicts } from "../src/requirements/domain/satisfiability-modulo-theories-query-verdicts.ts";
import { Scenario } from "../src/requirements/domain/scenario.ts";
import { ScenarioIdentifier } from "../src/requirements/domain/scenario-identifier.ts";
import { Scenarios } from "../src/requirements/domain/scenarios.ts";
import { TraceState } from "../src/requirements/domain/trace-state.ts";
import { TraceStates } from "../src/requirements/domain/trace-states.ts";
import { TraceValue } from "../src/requirements/domain/trace-value.ts";
import { VerificationFinding } from "../src/requirements/domain/verification-finding.ts";
import { VerificationFindings } from "../src/requirements/domain/verification-findings.ts";
import { VerificationReport } from "../src/requirements/domain/verification-report.ts";
import { VerificationReports } from "../src/requirements/domain/verification-reports.ts";
import { VerificationSkipped } from "../src/requirements/domain/verification-skipped.ts";
import { VerificationSkips } from "../src/requirements/domain/verification-skips.ts";
import { VerificationWitness } from "../src/requirements/domain/verification-witness.ts";

const factories = [
  DeclaredBindings satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof DeclaredBindings.of>,
    DeclaredBindings
  >,
  EnumerationMembers satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof EnumerationMembers.of>,
    EnumerationMembers
  >,
  ErrorMessages satisfies FallibleFirstClassCollectionFactory<Parameters<typeof ErrorMessages.of>, ErrorMessages>,
  FunctionalRequirementReferences satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof FunctionalRequirementReferences.of>,
    FunctionalRequirementReferences
  >,
  RequirementIdentifiers satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof RequirementIdentifiers.of>,
    RequirementIdentifiers
  >,
  ScenarioBindings satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof ScenarioBindings.of>,
    ScenarioBindings
  >,
  ScenarioVerdicts satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof ScenarioVerdicts.of>,
    ScenarioVerdicts
  >,
  TargetIdentifiers satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof TargetIdentifiers.of>,
    TargetIdentifiers
  >,
  BackgroundAssumptions satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof BackgroundAssumptions.of>,
    BackgroundAssumptions
  >,
  CrossCheckedEntries satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof CrossCheckedEntries.of>,
    CrossCheckedEntries
  >,
  FunctionalRequirementReferenceClaims satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof FunctionalRequirementReferenceClaims.of>,
    FunctionalRequirementReferenceClaims
  >,
  FunctionalRequirementReferenceIndex satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof FunctionalRequirementReferenceIndex.of>,
    FunctionalRequirementReferenceIndex
  >,
  IntermediateRepresentationAttributeCatalog satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationAttributeCatalog.of>,
    IntermediateRepresentationAttributeCatalog
  >,
  IntermediateRepresentationAttributeDeclarations satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationAttributeDeclarations.of>,
    IntermediateRepresentationAttributeDeclarations
  >,
  IntermediateRepresentationBackgroundDeclarations satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationBackgroundDeclarations.of>,
    IntermediateRepresentationBackgroundDeclarations
  >,
  IntermediateRepresentationEntityDeclarations satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationEntityDeclarations.of>,
    IntermediateRepresentationEntityDeclarations
  >,
  IntermediateRepresentationObligationDeclarations satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationObligationDeclarations.of>,
    IntermediateRepresentationObligationDeclarations
  >,
  IntermediateRepresentationScenarioDeclarations satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationScenarioDeclarations.of>,
    IntermediateRepresentationScenarioDeclarations
  >,
  ObligationIdentifiers satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof ObligationIdentifiers.of>,
    ObligationIdentifiers
  >,
  Obligations satisfies FallibleFirstClassCollectionFactory<Parameters<typeof Obligations.of>, Obligations>,
  QuintMachineComponents satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof QuintMachineComponents.of>,
    QuintMachineComponents
  >,
  RequirementAttributeDeclarations satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof RequirementAttributeDeclarations.of>,
    RequirementAttributeDeclarations
  >,
  SatisfiabilityModuloTheoriesEventPairProbes satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof SatisfiabilityModuloTheoriesEventPairProbes.of>,
    SatisfiabilityModuloTheoriesEventPairProbes
  >,
  SatisfiabilityModuloTheoriesQueryVerdicts satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof SatisfiabilityModuloTheoriesQueryVerdicts.of>,
    SatisfiabilityModuloTheoriesQueryVerdicts
  >,
  Scenarios satisfies FallibleFirstClassCollectionFactory<Parameters<typeof Scenarios.of>, Scenarios>,
  TraceState satisfies FallibleFirstClassCollectionFactory<Parameters<typeof TraceState.of>, TraceState>,
  TraceStates satisfies FallibleFirstClassCollectionFactory<Parameters<typeof TraceStates.of>, TraceStates>,
  VerificationFindings satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof VerificationFindings.of>,
    VerificationFindings
  >,
  VerificationReports satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof VerificationReports.of>,
    VerificationReports
  >,
  VerificationSkips satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof VerificationSkips.of>,
    VerificationSkips
  >,
];
const fallibleFactories = [
  FindingTargets satisfies NonEmptyFirstClassCollectionFactory<TargetIdentifier, FindingTargets>,
  DeclaredBindings satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof DeclaredBindings.of>,
    DeclaredBindings
  >,
  EnumerationMembers satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof EnumerationMembers.of>,
    EnumerationMembers
  >,
  ErrorMessages satisfies FallibleFirstClassCollectionFactory<Parameters<typeof ErrorMessages.of>, ErrorMessages>,
  FunctionalRequirementReferences satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof FunctionalRequirementReferences.of>,
    FunctionalRequirementReferences
  >,
  ScenarioBindings satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof ScenarioBindings.of>,
    ScenarioBindings
  >,
  ScenarioVerdicts satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof ScenarioVerdicts.of>,
    ScenarioVerdicts
  >,
  IntermediateRepresentationAttributeCatalog satisfies FallibleFirstClassCollectionFactory<
    Parameters<typeof IntermediateRepresentationAttributeCatalog.of>,
    IntermediateRepresentationAttributeCatalog
  >,
];
void factories;
void fallibleFactories;

const emptyCollections: readonly (readonly [string, () => Pick<FirstClassCollection<never>, "isEmpty">])[] = [
  ["DeclaredBindings", () => DeclaredBindings.of([])],
  ["EnumerationMembers", () => EnumerationMembers.of([])],
  ["ErrorMessages", () => ErrorMessages.of([])],
  ["FunctionalRequirementReferences", () => FunctionalRequirementReferences.of([])],
  ["RequirementIdentifiers", () => RequirementIdentifiers.of([])],
  ["ScenarioBindings", () => ScenarioBindings.of([])],
  ["ScenarioVerdicts", () => ScenarioVerdicts.of([])],
  ["TargetIdentifiers", () => TargetIdentifiers.of([])],
  ["BackgroundAssumptions", () => BackgroundAssumptions.of([])],
  ["CrossCheckedEntries", () => CrossCheckedEntries.of([])],
  ["FunctionalRequirementReferenceClaims", () => FunctionalRequirementReferenceClaims.of([])],
  ["FunctionalRequirementReferenceIndex", () => FunctionalRequirementReferenceIndex.of([])],
  [
    "IntermediateRepresentationAttributeCatalog",
    () => IntermediateRepresentationAttributeCatalog.of(IntermediateRepresentationEntityDeclarations.of([])),
  ],
  ["IntermediateRepresentationAttributeDeclarations", () => IntermediateRepresentationAttributeDeclarations.of([])],
  ["IntermediateRepresentationBackgroundDeclarations", () => IntermediateRepresentationBackgroundDeclarations.of([])],
  ["IntermediateRepresentationEntityDeclarations", () => IntermediateRepresentationEntityDeclarations.of([])],
  ["IntermediateRepresentationObligationDeclarations", () => IntermediateRepresentationObligationDeclarations.of([])],
  ["IntermediateRepresentationScenarioDeclarations", () => IntermediateRepresentationScenarioDeclarations.of([])],
  ["ObligationIdentifiers", () => ObligationIdentifiers.of([])],
  ["Obligations", () => Obligations.of([])],
  ["QuintMachineComponents", () => QuintMachineComponents.of([])],
  ["RequirementAttributeDeclarations", () => RequirementAttributeDeclarations.of([])],
  ["SatisfiabilityModuloTheoriesEventPairProbes", () => SatisfiabilityModuloTheoriesEventPairProbes.of([])],
  ["SatisfiabilityModuloTheoriesQueryVerdicts", () => SatisfiabilityModuloTheoriesQueryVerdicts.of([])],
  ["Scenarios", () => Scenarios.of([])],
  ["TraceState", () => TraceState.of([])],
  ["TraceStates", () => TraceStates.of([])],
  ["VerificationFindings", () => VerificationFindings.of([])],
  ["VerificationReports", () => VerificationReports.of([])],
  ["VerificationSkips", () => VerificationSkips.of([])],
];

function retainedSingleton<T extends Equatable<T>, C extends FirstClassCollection<T>>(
  factory: FirstClassCollectionFactory<[readonly T[]], C>,
  element: T,
): C {
  const input = [element];
  const collection = factory.of(input);
  input.length = 0;
  return collection;
}

const requirementReferences = FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]);
const referenceClaim = FunctionalRequirementReferenceClaim.of("OB-1", requirementReferences);
const attributeDeclaration = IntermediateRepresentationAttributeDeclaration.of({
  name: IntermediateRepresentationAttributeName.of("open"),
  kind: AttributeKind.of("bool"),
});
const entityDeclaration = IntermediateRepresentationEntityDeclaration.of({
  name: IntermediateRepresentationEntityName.of("Ticket"),
  attributes: IntermediateRepresentationAttributeDeclarations.of([attributeDeclaration]),
});

const singletonCollections: readonly (readonly [string, () => Pick<FirstClassCollection<never>, "isEmpty">])[] = [
  [
    "DeclaredBindings",
    () =>
      retainedSingleton(
        DeclaredBindings,
        BindingDeclaration.of(AttributePath.of("Ticket.open"), DeclaredBindingValue.of(Declaration.of(true))),
      ),
  ],
  ["EnumerationMembers", () => retainedSingleton(EnumerationMembers, EnumerationMember.of("open"))],
  ["ErrorMessages", () => retainedSingleton(ErrorMessages, ErrorMessage.of("first"))],
  [
    "FunctionalRequirementReferences",
    () => retainedSingleton(FunctionalRequirementReferences, RequirementIdentifier.of("FR-1")),
  ],
  ["RequirementIdentifiers", () => retainedSingleton(RequirementIdentifiers, RequirementIdentifier.of("FR-1"))],
  [
    "ScenarioBindings",
    () =>
      retainedSingleton(ScenarioBindings, ScenarioBinding.of(AttributePath.of("Ticket.open"), BindingValue.of(true))),
  ],
  [
    "ScenarioVerdicts",
    () =>
      retainedSingleton(
        ScenarioVerdicts,
        ScenarioVerdict.clean(BackendName.of("smt"), ContentHash.ofText("model"), TargetIdentifier.of("SC-1"), null),
      ),
  ],
  ["TargetIdentifiers", () => retainedSingleton(TargetIdentifiers, TargetIdentifier.of("OB-1"))],
  [
    "BackgroundAssumptions",
    () =>
      retainedSingleton(
        BackgroundAssumptions,
        BackgroundAssumption.of({ id: BackgroundAssumptionIdentifier.of("BG-1"), assert: { op: "bool", value: true } }),
      ),
  ],
  [
    "CrossCheckedEntries",
    () =>
      retainedSingleton(
        CrossCheckedEntries,
        CrossCheckedEntry.of({
          backend: BackendName.of("smt"),
          targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]),
        }),
      ),
  ],
  [
    "FunctionalRequirementReferenceClaims",
    () => retainedSingleton(FunctionalRequirementReferenceClaims, referenceClaim),
  ],
  ["FunctionalRequirementReferenceIndex", () => retainedSingleton(FunctionalRequirementReferenceIndex, referenceClaim)],
  [
    "IntermediateRepresentationAttributeDeclarations",
    () => retainedSingleton(IntermediateRepresentationAttributeDeclarations, attributeDeclaration),
  ],
  [
    "IntermediateRepresentationBackgroundDeclarations",
    () =>
      retainedSingleton(
        IntermediateRepresentationBackgroundDeclarations,
        IntermediateRepresentationBackgroundDeclaration.of({ id: BackgroundAssumptionIdentifier.of("BG-1") }),
      ),
  ],
  [
    "IntermediateRepresentationEntityDeclarations",
    () => retainedSingleton(IntermediateRepresentationEntityDeclarations, entityDeclaration),
  ],
  [
    "IntermediateRepresentationObligationDeclarations",
    () =>
      retainedSingleton(
        IntermediateRepresentationObligationDeclarations,
        IntermediateRepresentationObligationDeclaration.of({ id: ObligationIdentifier.of("OB-1") }),
      ),
  ],
  [
    "IntermediateRepresentationScenarioDeclarations",
    () =>
      retainedSingleton(
        IntermediateRepresentationScenarioDeclarations,
        IntermediateRepresentationScenarioDeclaration.of({
          id: ScenarioIdentifier.of("SC-1"),
          bindings: DeclaredBindings.of([]),
          hasEvent: false,
        }),
      ),
  ],
  ["ObligationIdentifiers", () => retainedSingleton(ObligationIdentifiers, ObligationIdentifier.of("OB-1"))],
  [
    "Obligations",
    () =>
      retainedSingleton(
        Obligations,
        Obligation.of({
          id: ObligationIdentifier.of("OB-1"),
          nature: ObligationNature.of("invariant"),
          functionalRequirementReferences: requirementReferences,
          assert: { op: "bool", value: true },
        }),
      ),
  ],
  [
    "QuintMachineComponents",
    () =>
      retainedSingleton(
        QuintMachineComponents,
        QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: { op: "bool", value: true } }),
      ),
  ],
  [
    "RequirementAttributeDeclarations",
    () =>
      retainedSingleton(
        RequirementAttributeDeclarations,
        RequirementAttributeDeclaration.of({ path: AttributePath.of("Ticket.open"), kind: "bool" }),
      ),
  ],
  [
    "SatisfiabilityModuloTheoriesEventPairProbes",
    () =>
      retainedSingleton(
        SatisfiabilityModuloTheoriesEventPairProbes,
        SatisfiabilityModuloTheoriesEventPairProbe.of({
          qOverlap: QueryLabel.of("overlap:1"),
          qJoint: QueryLabel.of("joint:1"),
          a: ObligationIdentifier.of("OB-1"),
          b: ObligationIdentifier.of("OB-2"),
          trigger: TriggerName.of("submit"),
        }),
      ),
  ],
  [
    "Scenarios",
    () =>
      retainedSingleton(
        Scenarios,
        Scenario.of({
          id: ScenarioIdentifier.of("SC-1"),
          expectation: ScenarioExpectation.of("accept"),
          functionalRequirementReferences: requirementReferences,
          bindings: ScenarioBindings.of([]),
        }),
      ),
  ],
  [
    "TraceState",
    () => retainedSingleton(TraceState, TraceStateEntry.of(AttributePath.of("Ticket.open"), TraceValue.absent())),
  ],
  ["TraceStates", () => retainedSingleton(TraceStates, TraceState.empty())],
  [
    "VerificationFindings",
    () =>
      retainedSingleton(
        VerificationFindings,
        VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: requirementReferences,
          targets: FindingTargets.of(TargetIdentifier.of("OB-1"), []),
          witness: VerificationWitness.model({}),
          detail: "conflict",
        }),
      ),
  ],
  [
    "VerificationReports",
    () =>
      retainedSingleton(
        VerificationReports,
        VerificationReport.irUnreadable(
          VerificationReportIdentifier.of(ArtifactPath.of("verify"), "smt"),
          "exhaustive",
          "broken",
        ),
      ),
  ],
  [
    "VerificationSkips",
    () =>
      retainedSingleton(
        VerificationSkips,
        VerificationSkipped.of({ target: TargetIdentifier.of("OB-1"), reason: SkipReason.unavailable() }),
      ),
  ],
  [
    "IntermediateRepresentationAttributeCatalog",
    () =>
      IntermediateRepresentationAttributeCatalog.of(
        IntermediateRepresentationEntityDeclarations.of([entityDeclaration]),
      ),
  ],
  [
    "SatisfiabilityModuloTheoriesQueryVerdicts",
    () =>
      SatisfiabilityModuloTheoriesQueryVerdicts.of([
        SatisfiabilityModuloTheoriesQueryVerdictEntry.of(
          QueryLabel.of("global"),
          SatisfiabilityModuloTheoriesQueryVerdict.missing(),
        ),
      ]),
  ],
];

describe("kernel / requirements のコレクション契約", () => {
  test.each(singletonCollections)("%s は所有要素が1件なら空ではない", (_name, create) => {
    expect(create().isEmpty()).toBe(false);
  });

  test.each(emptyCollections)("%s は所有要素ゼロを空とする", (_name, create) => {
    expect(create().isEmpty()).toBe(true);
  });

  test("ErrorMessages は入力配列の変更から所有要素と順序を守る", () => {
    const input = [ErrorMessage.of("first")];
    const messages = ErrorMessages.of(input);
    input.splice(0, 1, ErrorMessage.of("changed"));
    expect(messages.isEmpty()).toBe(false);
    expect([...messages].map((message) => message.asString())).toEqual(["first"]);
    expect(messages.add(ErrorMessage.of("second")).isEmpty()).toBe(false);
  });

  test("ScenarioVerdicts は比較がゼロでも所有判定があれば空ではない", () => {
    const input = [
      ScenarioVerdict.clean(BackendName.of("smt"), ContentHash.ofText("model"), TargetIdentifier.of("SC-1"), null),
    ];
    const verdicts = ScenarioVerdicts.of(input);
    input.length = 0;
    expect(verdicts.isEmpty()).toBe(false);
    expect([...verdicts.comparisons()]).toEqual([]);
    expect([...verdicts]).toHaveLength(1);
  });

  test("TraceState の空は値の欠落ではなく所有する属性数で決まる", () => {
    const state = TraceState.of([TraceStateEntry.of(AttributePath.of("Ticket.open"), TraceValue.absent())]);
    expect(state.isEmpty()).toBe(false);
    expect(state.toDocument()).toEqual({ "Ticket.open": null });
  });
});

describe("FindingTargets の非空契約", () => {
  test("単一対象を受理する", () => {
    const targets = FindingTargets.of(TargetIdentifier.of("OB-1"), []);
    expect(targets.count()).toBe(1);
    expect(targets.toStrings()).toEqual(["OB-1"]);
    expect([...targets].map((target) => target.asString())).toEqual(["OB-1"]);
    expect(targets.include(TargetIdentifier.of("OB-1"))).toBe(true);
    expect(targets.include(TargetIdentifier.of("OB-2"))).toBe(false);
    expect(FindingTargets.parse(TargetIdentifier.of("OB-1"), []).ok).toBe(true);
  });

  test("tailの入力配列を変更しても所有要素が変わらない", () => {
    const tail = [TargetIdentifier.of("OB-2")];
    const targets = FindingTargets.of(TargetIdentifier.of("OB-1"), tail);
    tail.length = 0;
    expect(targets.toStrings()).toEqual(["OB-1", "OB-2"]);
  });

  test("上限を受理し、超過はコピー前に拒否する", () => {
    const target = TargetIdentifier.of("OB-1");
    const accepted = Array.from({ length: 65_535 }, () => target);
    expect(FindingTargets.of(target, accepted).count()).toBe(65_536);
    expect(FindingTargets.parse(target, accepted).ok).toBe(true);
    const oversized = [...accepted, target];
    let iteratorCalled = false;
    oversized[Symbol.iterator] = function* () {
      iteratorCalled = true;
      yield target;
      return undefined;
    };
    expect(() => FindingTargets.of(target, oversized)).toThrow(IllegalArgumentException);
    const parsed = FindingTargets.parse(target, oversized);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).not.toBeInstanceOf(Error);
      expect(parsed.error.kind).toBe("too-many-finding-targets");
    }
    expect(iteratorCalled).toBe(false);
  });

  test("読取中に上限を超える入力でも判定済みのsnapshotだけを保持する", () => {
    const input = [TargetIdentifier.of("OB-1")];
    input[Symbol.iterator] = function* () {
      for (let index = 0; index < 65_537; index++) yield TargetIdentifier.of("OB-1");
      return undefined;
    };
    expect(() => FindingTargets.of(TargetIdentifier.of("OB-1"), input)).toThrow(IllegalArgumentException);
    const parsed = FindingTargets.parse(TargetIdentifier.of("OB-1"), input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.kind).toBe("too-many-finding-targets");
  });

  test("tailが空でもheadが残り、反復を一度だけ行って受理snapshotを保持する", () => {
    const emptyReading = [TargetIdentifier.of("OB-1")];
    emptyReading[Symbol.iterator] = () => [][Symbol.iterator]();
    expect(FindingTargets.parse(TargetIdentifier.of("OB-1"), emptyReading).ok).toBe(true);
    let reads = 0;
    const once = [TargetIdentifier.of("OB-1")];
    once[Symbol.iterator] = function* () {
      reads++;
      yield TargetIdentifier.of(reads === 1 ? "OB-1" : "OB-2");
      return undefined;
    };
    expect(FindingTargets.of(TargetIdentifier.of("OB-0"), once).toStrings()).toEqual(["OB-0", "OB-1"]);
    expect(reads).toBe(1);
  });

  test("正準化と一意化は非空と元の所有順を保つ", () => {
    const targets = FindingTargets.of(TargetIdentifier.of("OB-2"), ["OB-1", "OB-2"].map(TargetIdentifier.of));
    expect(targets.sortedCanonically().toStrings()).toEqual(["OB-1", "OB-2", "OB-2"]);
    const unique = targets.sortedUniqueCanonically();
    expect(unique.toStrings()).toEqual(["OB-1", "OB-2"]);
    expect(unique.joined(",")).toBe("OB-1,OB-2");
    expect(unique.toArray().map((target) => target.asString())).toEqual(["OB-1", "OB-2"]);
    expect(targets.toStrings()).toEqual(["OB-2", "OB-1", "OB-2"]);
  });
});

function emptyRequirementsModel(): RequirementsModel {
  return RequirementsModel.of({
    id: FormalModelIdentifier.of(ArtifactPath.of("requirements.ir.json")),
    irHash: ContentHash.ofText("empty model"),
    irVersion: IntermediateRepresentationVersion.of("1.0.0"),
    sourceDocument: new Uint8Array(),
    attributes: RequirementAttributeDeclarations.of([]),
    obligations: Obligations.of([]),
    scenarios: Scenarios.of([]),
    background: BackgroundAssumptions.of([]),
  });
}

describe("対象を持たない診断をレポートの成功へ変換しない", () => {
  test.each([QuintMachineRunVerdict.deadlock(null), QuintMachineRunVerdict.violation(TraceStates.of([]))])(
    "Quint機械結果の対象欠落をResultから公開unavailableへ伝える",
    (machine) => {
      const model = emptyRequirementsModel();
      const method = VerificationMethod.of("simulation");
      const interpreted = machine.interpret(model, QuintMachineComponents.of([]), ObligationIdentifiers.of([]), method);
      expect(interpreted.ok).toBe(false);
      if (!interpreted.ok) {
        expect(interpreted.error.kind).toBe("missing-finding-targets");
        expect(interpreted.error).not.toBeInstanceOf(Error);
      }
      const checked = QuintCheckResult.of({
        kind: "checked",
        method,
        plan: QuintMachinePlan.of({
          invariantComponents: QuintMachineComponents.of([]),
          eventIds: ObligationIdentifiers.of([]),
          scenariosWithInit: [],
        }),
        compileSkips: VerificationSkips.of([]),
        runs: QuintRuns.of({ machine, temporals: KeyedIndex.empty(), scenarios: KeyedIndex.empty() }),
      });
      const report = checked.reportFor(model, VerificationReportIdentifier.of(ArtifactPath.of("verify"), "quint"));
      expect(report.isUnavailable()).toBe(true);
      expect(report.toDocument()).toMatchObject({
        findings: [],
        skipped: [],
        unavailable: { reason: expect.stringContaining("missing-finding-targets") },
      });
    },
  );

  test("SMT完全性診断の対象欠落を公開unavailableへ伝える", () => {
    const model = emptyRequirementsModel();
    const trigger = TriggerName.of("submit");
    const plan = SatisfiabilityModuloTheoriesVerificationPlan.of({
      compiled: KeySet.empty(),
      vacuityQueries: KeyedIndex.empty(),
      skipped: VerificationSkips.of([]),
      labelToTarget: KeyedIndex.empty(),
      eventPairs: SatisfiabilityModuloTheoriesEventPairProbes.of([]),
      gapTriggers: KeyedIndex.of([[trigger, TargetIdentifiers.of([])]]),
      scenarioQueries: KeyedIndex.empty(),
    });
    const verdicts = SatisfiabilityModuloTheoriesQueryVerdicts.of([
      SatisfiabilityModuloTheoriesQueryVerdictEntry.of(
        QueryLabel.of("global"),
        SatisfiabilityModuloTheoriesQueryVerdict.of({ status: "sat" }),
      ),
      SatisfiabilityModuloTheoriesQueryVerdictEntry.of(
        QueryLabel.of("gap:submit"),
        SatisfiabilityModuloTheoriesQueryVerdict.of({ status: "sat" }),
      ),
    ]);
    const interpreted = plan.interpret(model, verdicts);
    expect(interpreted.ok).toBe(false);
    if (!interpreted.ok) expect(interpreted.error.kind).toBe("missing-finding-targets");
    const report = SatisfiabilityModuloTheoriesCheck.of({ plan, result: { kind: "solved", verdicts } }).reportFor(
      model,
      VerificationReportIdentifier.of(ArtifactPath.of("verify"), "smt"),
    );
    expect(report.isUnavailable()).toBe(true);
    expect(report.toDocument()).toMatchObject({
      findings: [],
      skipped: [],
      unavailable: { reason: expect.stringContaining("missing-finding-targets") },
    });
  });

  test("SMT大域矛盾の対象が見つからなくても正常な空findingとして捨てない", () => {
    const result = SatisfiabilityModuloTheoriesProbe.consistency(
      TargetIdentifiers.of([]),
      KeyedIndex.empty(),
    ).interpret(
      emptyRequirementsModel(),
      SatisfiabilityModuloTheoriesQueryVerdicts.of([
        SatisfiabilityModuloTheoriesQueryVerdictEntry.of(
          QueryLabel.of("global"),
          SatisfiabilityModuloTheoriesQueryVerdict.of({ status: "unsat", core: [] }),
        ),
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("missing-finding-targets");
  });

  test("通常ドメイン処理の対象超過は対象集合のparseで非例外のParseErrorになる", () => {
    const result = TargetIdentifiers.parse(Array.from({ length: 65_537 }, () => TargetIdentifier.of("OB-1")));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("too-many-target-identifiers");
      expect(result.error).not.toBeInstanceOf(Error);
    }
  });
});
