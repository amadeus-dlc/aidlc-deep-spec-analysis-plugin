import { describe, expect, test } from "bun:test";
import {
  Check,
  CheckSeverity,
  DesignArtifactReference,
  DesignArtifacts,
  FindingCount,
  HealthVerdict,
  InstallationManifest,
  IntentLocation,
  PluginVersion,
  StableReleases,
  StageScope,
  StageScopes,
  StructuralDebt,
  StructuralObservation,
} from "@deep-spec-analysis/doctor-domain";
import type { Equatable } from "@deep-spec-analysis/kernel-domain";
import {
  ArtifactPath,
  ContentHash,
  ErrorMessage,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  FunctionalRequirementReferences,
  KeyedIndex,
  SkipReason,
  TargetIdentifier,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import * as Refcheck from "@deep-spec-analysis/refcheck-domain";

function iterableContract<Element extends Equatable<Element>>(
  name: string,
  create: (values: readonly Element[]) => FirstClassCollection<Element>,
  element: Element,
): void {
  test(`${name}: 空・単要素の判定は所有要素数を表し、入力配列の変更から独立する`, () => {
    const values: Element[] = [];
    const empty = create(values);
    values.push(element);
    const singleton = create(values);
    values.length = 0;
    expect(empty.isEmpty()).toBe(true);
    expect(Array.from(empty)).toHaveLength(0);
    expect(singleton.isEmpty()).toBe(false);
    expect(Array.from(singleton)).toHaveLength(1);
  });
}

const element = Refcheck.ElementPath.of("entities[0]");
const attributeName = Refcheck.AttributeName.of("status");
const entityName = Refcheck.EntityName.of("Account");
const componentName = Refcheck.ComponentName.of("Accounts");
const unit = UnitName.of("u1-accounts");
const line = Refcheck.LineNumber.of(1);
const attribute = Refcheck.AttributeDeclaration.of({
  name: attributeName,
  element,
  type: null,
  uniqueIsTrue: false,
  references: null,
  allowed: null,
  def: null,
  minDeclared: false,
  maxDeclared: false,
  min: null,
  max: null,
});
const entity = Refcheck.EntityDeclaration.of({
  name: entityName,
  element,
  attrs: Refcheck.AttributeDeclarations.of([]),
  rels: Refcheck.RelationshipDeclarations.of([]),
});
const artifact = DesignArtifactReference.of({
  location: IntentLocation.of(ArtifactPath.of("spaces/default"), ArtifactPath.of("intents/example")),
  tool: ArtifactPath.of("tools/refcheck.ts"),
  artifactPath: ArtifactPath.of("functional-design.md"),
  relativePath: ArtifactPath.of("functional-design.md"),
});
const target = TargetIdentifier.of("entity:Account");

describe("refcheckの反復可能コレクション契約", () => {
  iterableContract("AllowedValues", Refcheck.AllowedValues.of, Refcheck.AllowedValue.of("active"));
  iterableContract("AttributeDeclarations", Refcheck.AttributeDeclarations.of, attribute);
  iterableContract("AttributeNames", Refcheck.AttributeNames.of, attributeName);
  iterableContract("CheckFamilies", Refcheck.CheckFamilies.of, Refcheck.CheckFamily.of("FD-E1"));
  iterableContract(
    "ComponentEntities",
    Refcheck.ComponentEntities.of,
    Refcheck.ComponentEntity.of({
      name: entityName,
      element,
      identifier: attributeName,
      references: Refcheck.EntityReferences.of([]),
    }),
  );
  iterableContract(
    "ComponentReferences",
    Refcheck.ComponentReferences.of,
    Refcheck.ComponentReference.of({
      component: componentName,
      element,
    }),
  );
  iterableContract(
    "ComponentShapeErrors",
    Refcheck.ComponentShapeErrors.of,
    Refcheck.ComponentShapeError.of({ element, detail: "missing name" }),
  );
  iterableContract(
    "Components",
    Refcheck.Components.of,
    Refcheck.Component.of({
      name: componentName,
      element,
      dependsOn: Refcheck.ComponentReferences.of([]),
      dependents: Refcheck.ComponentReferences.of([]),
      entities: Refcheck.ComponentEntities.of([]),
    }),
  );
  iterableContract(
    "ContractRows",
    Refcheck.ContractRows.of,
    Refcheck.ContractRow.of({
      id: Refcheck.ContractIdentifier.of("C-1"),
      provider: Refcheck.ContractParty.of("u1-accounts"),
      consumer: Refcheck.ContractParty.of("u2-orders"),
      owner: Refcheck.ContractParty.of("u1-accounts"),
      line,
    }),
  );
  iterableContract(
    "DomainEntitySketches",
    Refcheck.DomainEntitySketches.of,
    Refcheck.DomainEntitySketch.of({
      name: entityName,
      component: componentName,
      attributes: Refcheck.AttributeNames.of([]),
    }),
  );
  iterableContract("EntityDeclarations", Refcheck.EntityDeclarations.of, entity);
  iterableContract(
    "EntityReferences",
    Refcheck.EntityReferences.of,
    Refcheck.EntityReference.of({ entity: entityName, ownedBy: componentName, element }),
  );
  iterableContract(
    "Findings",
    Refcheck.Findings.of,
    Refcheck.Finding.of({
      kind: FindingKind.structureInvalid(),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      targets: FindingTargets.of(target, []),
      witness: { refs: Refcheck.WitnessReferences.of([]) },
      detail: "invalid",
    }),
  );
  iterableContract(
    "InputAnchors",
    Refcheck.InputAnchors.of,
    Refcheck.InputAnchor.of({ artifact: "functional-design.md", sha256: ContentHash.ofText("document") }),
  );
  iterableContract(
    "RelationshipDeclarations",
    Refcheck.RelationshipDeclarations.of,
    Refcheck.RelationshipDeclaration.of({
      element,
      from: entityName,
      to: null,
      cardinality: null,
      hasDirection: false,
    }),
  );
  iterableContract(
    "RuleDeclarations",
    Refcheck.RuleDeclarations.of,
    Refcheck.RuleDeclaration.of({
      id: null,
      element,
      category: null,
      appliesTo: null,
      sourceIds: Refcheck.SourceIdentifiers.of([]),
      missing: [],
    }),
  );
  iterableContract("ShapeErrors", Refcheck.ShapeErrors.of, Refcheck.ShapeError.of({ element, detail: "invalid" }));
  iterableContract("Skips", Refcheck.Skips.of, Refcheck.Skipped.of({ target, reason: SkipReason.of("unavailable") }));
  iterableContract("SourceIdentifiers", Refcheck.SourceIdentifiers.of, Refcheck.SourceIdentifier.of("FR-1"));
  iterableContract(
    "SpecificationBlockAssessments",
    Refcheck.SpecificationBlockAssessments.of,
    Refcheck.SpecificationBlockAssessment.sound(Refcheck.BlockIndex.of(1), line),
  );
  iterableContract(
    "StateMachineSketches",
    Refcheck.StateMachineSketches.of,
    Refcheck.StateMachineSketch.unrecognized(line, ErrorMessage.of("unknown syntax")),
  );
  iterableContract("StateNames", Refcheck.StateNames.of, Refcheck.StateName.of("active"));
  iterableContract(
    "UnitDeclarations",
    Refcheck.UnitDeclarations.of,
    Refcheck.UnitDeclaration.of({ name: unit, dependsOn: Refcheck.UnitNames.of([]) }),
  );
  iterableContract("UnitNames", Refcheck.UnitNames.of, unit);
  iterableContract(
    "WitnessReferences",
    Refcheck.WitnessReferences.of,
    Refcheck.WitnessReference.of({ artifact: "functional-design.md", element: "entities[0]" }),
  );
});

describe("doctorと索引のコレクション契約", () => {
  iterableContract("DesignArtifacts", DesignArtifacts.of, artifact);
  iterableContract(
    "HealthVerdict",
    HealthVerdict.of,
    Check.of({ pass: true, label: "ready", severity: CheckSeverity.error() }),
  );
  iterableContract("StageScopes", StageScopes.of, StageScope.of("refactor"));

  test("InstallationManifestは標準出荷台帳を反復でき、空判定を公開しない", () => {
    const manifest = InstallationManifest.standard();
    expect(Array.from(manifest).length).toBeGreaterThan(0);
    expect("isEmpty" in manifest).toBe(false);
  });

  test("SiblingUnitIndexの空は登録unitがゼロを意味し、空の宣言を持つunitとは区別する", () => {
    const empty = Refcheck.SiblingUnitIndex.of(KeyedIndex.empty<UnitName, Refcheck.EntityDeclarations>());
    const declared = Refcheck.SiblingUnitIndex.of(KeyedIndex.of([[unit, Refcheck.EntityDeclarations.of([])]]));
    expect(empty.isEmpty()).toBe(true);
    expect(declared.isEmpty()).toBe(false);
    expect(declared.definersOf(entityName.normalized()).isEmpty()).toBe(true);
  });

  test("StructuralDebtは問題や走査がゼロでも観測を持てば空ではない", () => {
    const source = [StructuralObservation.unavailable(artifact, ErrorMessage.of("backend unavailable"))];
    const unscanned = StructuralDebt.of(source);
    source.length = 0;
    const clean = StructuralDebt.of([StructuralObservation.of(artifact, FindingCount.of(0))]);
    expect(StructuralDebt.of([]).isEmpty()).toBe(true);
    expect(unscanned.isEmpty()).toBe(false);
    expect(unscanned.hasScans()).toBe(false);
    expect(unscanned.rows()).toHaveLength(1);
    expect(clean.isEmpty()).toBe(false);
    expect(clean.totalFindings()).toBe(0);
  });

  test("StableReleasesは版の有無を保持し、入力変更の影響を受けない", () => {
    const source = [PluginVersion.of("1.0.0")];
    const releases = StableReleases.of(source);
    source.length = 0;
    expect(StableReleases.of([]).isEmpty()).toBe(true);
    expect(releases.isEmpty()).toBe(false);
  });

  test("StageScopesの上限はofのpanicとparseの非例外ParseErrorで表す", () => {
    const scopes = Array.from({ length: 1024 }, () => StageScope.of("refactor"));
    expect(StageScopes.of(scopes).isEmpty()).toBe(false);
    expect(StageScopes.parse(scopes).ok).toBe(true);
    scopes.push(StageScope.of("refactor"));
    expect(() => StageScopes.of(scopes)).toThrow(IllegalArgumentException);
    const parsed = StageScopes.parse(scopes);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).not.toBeInstanceOf(Error);
      expect(parsed.error.kind).toBe("too-many-stage-scopes");
    }
  });
});
