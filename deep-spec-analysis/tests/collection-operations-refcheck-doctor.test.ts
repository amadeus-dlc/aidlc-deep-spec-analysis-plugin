import { describe, expect, test } from "bun:test";
import * as Doctor from "@deep-spec-analysis/doctor-domain";
import {
  ArtifactPath,
  ContentHash,
  type Equatable,
  ErrorMessage,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  FunctionalRequirementReferences,
  KeyedIndex,
  RequirementIdentifier,
  SkipReason,
  TargetIdentifier,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import * as Reference from "@deep-spec-analysis/refcheck-domain";

function operations<E extends Equatable<E>, C extends FirstClassCollection<E>>(
  name: string,
  factory: {
    of(elements: readonly E[]): C;
    parse(elements: readonly E[]): Result<C, ParseError>;
  },
  element: (index: number) => E,
  maximum = 65_536,
): void {
  const create = factory.of;
  test(`${name}: 値の同値性、要素の順序、短絡、絞り込みと元集合の不変性`, () => {
    const first = element(1);
    const second = element(2);
    const firstCopy = element(1);
    const parsed = factory.parse([element(1), element(2)]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.include(firstCopy)).toBe(true);
    const atLimit = Array.from({ length: maximum }, () => first);
    const boundary = factory.parse(atLimit);
    expect(boundary.ok).toBe(true);
    const oversized = [...atLimit, first];
    expect(() => create(oversized)).toThrow(IllegalArgumentException);
    const failure = factory.parse(oversized);
    expect(failure.ok).toBe(false);
    if (!failure.ok) expect(failure.error).not.toBeInstanceOf(Error);

    expect(first.equals(firstCopy)).toBe(true);
    expect(firstCopy.equals(first)).toBe(true);
    expect(first.equals(second)).toBe(false);
    const input = [first, second];
    const collection = create(input);
    input.length = 0;
    const before = [...collection];

    expect(collection.head().equals(firstCopy)).toBe(true);
    expect(collection.at(1).equals(element(2))).toBe(true);
    expect(collection.include(firstCopy)).toBe(true);
    expect(collection.include(element(3))).toBe(false);
    let reads = 0;
    expect(
      collection.exists((item) => {
        reads++;
        return item.equals(firstCopy);
      }),
    ).toBe(true);
    expect(reads).toBe(1);
    expect(collection.exists(() => false)).toBe(false);

    const tail = collection.tail();
    expect([...tail]).toHaveLength(1);
    expect(tail.head().equals(element(2))).toBe(true);
    expect(tail.include(firstCopy)).toBe(false);
    const filtered = collection.filter((item) => item.equals(firstCopy));
    expect([...filtered]).toHaveLength(1);
    expect(filtered.head().equals(firstCopy)).toBe(true);
    expect(collection.filter(() => false).isEmpty()).toBe(true);
    expect(collection.foldLeft(0, (accumulator) => accumulator + 1)).toBe(2);
    const mapped = collection.map((item) => item);
    expect(mapped).not.toBe(collection);
    expect([...mapped].map((item, index) => item.equals(before[index] ?? first))).toEqual([true, true]);
    const empty = create([]);
    const combined = collection.combine(collection);
    expect(combined).not.toBe(collection);
    expect([...combined].map((item) => item.equals(firstCopy))).toEqual([true, false, true, false]);
    expect(empty.combine(collection)).not.toBe(collection);
    expect(collection.combine(empty)).not.toBe(collection);
    expect([...empty.combine(collection)].map((item, index) => item.equals(before[index] ?? first))).toEqual([
      true,
      true,
    ]);
    expect([...collection.combine(empty)].map((item, index) => item.equals(before[index] ?? first))).toEqual([
      true,
      true,
    ]);
    expect([...collection].map((item, index) => item.equals(before[index] ?? first))).toEqual([true, true]);
    expect(create([]).isEmpty()).toBe(true);
    expect(
      create([]).exists(() => {
        throw new Error("empty collection evaluated its predicate");
      }),
    ).toBe(false);
  });
}

const path = (index: number) => Reference.ElementPath.of(`entities[${index}]`);
const name = (index: number) => Reference.EntityName.of(`Account${index}`);
const attributeName = (index: number) => Reference.AttributeName.of(`status${index}`);
const componentName = (index: number) => Reference.ComponentName.of(`Accounts${index}`);
const target = (index: number) => TargetIdentifier.of(`entity:Account${index}`);
const line = (index: number) => Reference.LineNumber.of(index);
const attribute = (index: number, defaultValue: string | number = "open") =>
  Reference.AttributeDeclaration.of({
    name: attributeName(index),
    element: path(index),
    type: Reference.TypeName.of("enum"),
    uniqueIsTrue: true,
    references: Reference.ReferenceTarget.of("Other.id"),
    allowed: Reference.AllowedValues.of([Reference.AllowedValue.of("open"), Reference.AllowedValue.of("closed")]),
    def: Reference.AttributeDefault.of(defaultValue),
    minDeclared: true,
    maxDeclared: true,
    min: Reference.NumericBound.of(0),
    max: Reference.NumericBound.of(10),
  });
const relationship = (index: number) =>
  Reference.RelationshipDeclaration.of({
    element: path(index),
    from: name(index),
    to: name(index + 1),
    cardinality: Reference.CardinalityNotation.of("one-to-many"),
    hasDirection: true,
  });
const entity = (index: number) =>
  Reference.EntityDeclaration.of({
    name: name(index),
    element: path(index),
    attrs: Reference.AttributeDeclarations.of([attribute(index)]),
    rels: Reference.RelationshipDeclarations.of([relationship(index)]),
  });
const componentReference = (index: number) =>
  Reference.ComponentReference.of({ component: componentName(index), element: path(index) });
const entityReference = (index: number) =>
  Reference.EntityReference.of({ entity: name(index), ownedBy: componentName(index), element: path(index) });
const componentEntity = (index: number) =>
  Reference.ComponentEntity.of({
    name: name(index),
    element: path(index),
    identifier: attributeName(index),
    references: Reference.EntityReferences.of([entityReference(index)]),
  });
const location = (index: number) =>
  Doctor.IntentLocation.of(ArtifactPath.of("default"), ArtifactPath.of(`intents/example${index}`));
const artifact = (index: number) =>
  Doctor.DesignArtifactReference.of({
    location: location(index),
    tool: ArtifactPath.of("refcheck.ts"),
    artifactPath: ArtifactPath.of(`/project/functional-design${index}.md`),
    relativePath: ArtifactPath.of(`functional-design${index}.md`),
  });
const witness = (index: number) =>
  Reference.WitnessReference.of({
    artifact: "functional-design.md",
    element: `entities[${index}]`,
    value: `Account${index}`,
  });

describe("refcheckの全通常コレクションの操作と等価性", () => {
  operations("AllowedValues", Reference.AllowedValues, (i) => Reference.AllowedValue.of(`state${i}`));
  operations("AttributeDeclarations", Reference.AttributeDeclarations, attribute);
  operations("AttributeNames", Reference.AttributeNames, attributeName);
  operations("CheckFamilies", Reference.CheckFamilies, (i) => Reference.CheckFamily.of(`FD-E${i}`));
  operations("ComponentEntities", Reference.ComponentEntities, componentEntity);
  operations("ComponentReferences", Reference.ComponentReferences, componentReference);
  operations("ComponentShapeErrors", Reference.ComponentShapeErrors, (i) =>
    Reference.ComponentShapeError.of({ element: path(i), detail: `missing ${i}` }),
  );
  operations("Components", Reference.Components, (i) =>
    Reference.Component.of({
      name: componentName(i),
      element: path(i),
      dependsOn: Reference.ComponentReferences.of([componentReference(i + 10)]),
      dependents: Reference.ComponentReferences.of([componentReference(i + 20)]),
      entities: Reference.ComponentEntities.of([componentEntity(i)]),
    }),
  );
  operations("ContractRows", Reference.ContractRows, (i) =>
    Reference.ContractRow.of({
      id: Reference.ContractIdentifier.of(`C-${i}`),
      provider: Reference.ContractParty.of(`u${i}`),
      consumer: Reference.ContractParty.of(`u${i + 1}`),
      owner: Reference.ContractParty.of(`u${i}`),
      line: line(i),
    }),
  );
  operations("DomainEntitySketches", Reference.DomainEntitySketches, (i) =>
    Reference.DomainEntitySketch.of({
      name: name(i),
      component: componentName(i),
      attributes: Reference.AttributeNames.of([attributeName(i)]),
    }),
  );
  operations("EntityDeclarations", Reference.EntityDeclarations, entity);
  operations("EntityReferences", Reference.EntityReferences, entityReference);
  operations("Findings", Reference.Findings, (i) =>
    Reference.Finding.of({
      kind: FindingKind.structureInvalid(),
      functionalRequirementReferences: FunctionalRequirementReferences.of([RequirementIdentifier.of(`FR-${i}`)]),
      targets: FindingTargets.of(target(i), []),
      witness: { refs: Reference.WitnessReferences.of([witness(i)]) },
      detail: `invalid ${i}`,
    }),
  );
  operations("InputAnchors", Reference.InputAnchors, (i) =>
    Reference.InputAnchor.of({ artifact: `design${i}.md`, sha256: ContentHash.ofText(`document${i}`) }),
  );
  operations("RelationshipDeclarations", Reference.RelationshipDeclarations, relationship);
  operations("RuleDeclarations", Reference.RuleDeclarations, (i) =>
    Reference.RuleDeclaration.of({
      id: Reference.DeclaredRuleIdentifier.of(`BR-${i}`),
      element: path(i),
      category: Reference.RuleCategory.of("constraint"),
      appliesTo: Reference.AppliesTo.of("Account"),
      sourceIds: Reference.SourceIdentifiers.of([Reference.SourceIdentifier.of(`FR-${i}`)]),
      missing: ["expression"],
    }),
  );
  operations("ShapeErrors", Reference.ShapeErrors, (i) =>
    Reference.ShapeError.of({ element: path(i), detail: `invalid ${i}` }),
  );
  operations("Skips", Reference.Skips, (i) =>
    Reference.Skipped.of({ target: target(i), reason: SkipReason.unavailable(), detail: `missing ${i}` }),
  );
  operations("SourceIdentifiers", Reference.SourceIdentifiers, (i) => Reference.SourceIdentifier.of(`FR-${i}`));
  operations("SpecificationBlockAssessments", Reference.SpecificationBlockAssessments, (i) =>
    Reference.SpecificationBlockAssessment.unparseable(Reference.BlockIndex.of(i), line(i), `invalid${i}`),
  );
  operations("StateMachineSketches", Reference.StateMachineSketches, (i) =>
    Reference.StateMachineSketch.of({
      spec: Reference.MachineSpecification.of(`Account${i}.status`),
      states: Reference.StateNames.of([Reference.StateName.of("open")]),
      fenceLine: line(i),
      unsupported: null,
    }),
  );
  operations("StateNames", Reference.StateNames, (i) => Reference.StateName.of(`state${i}`));
  operations("UnitDeclarations", Reference.UnitDeclarations, (i) =>
    Reference.UnitDeclaration.of({
      name: UnitName.of(`u${i}`),
      dependsOn: Reference.UnitNames.of([UnitName.of(`u${i + 10}`)]),
    }),
  );
  operations("UnitNames", Reference.UnitNames, (i) => UnitName.of(`u${i}`));
  operations("WitnessReferences", Reference.WitnessReferences, witness);
});

describe("doctorの全通常コレクションの操作と等価性", () => {
  operations("DesignArtifacts", Doctor.DesignArtifacts, artifact);
  operations("HealthVerdict", Doctor.HealthVerdict, (i) =>
    Doctor.Check.of({ pass: true, label: `check${i}`, fix: `fix${i}`, severity: Doctor.CheckSeverity.error() }),
  );
  operations("StageScopes", Doctor.StageScopes, (i) => Doctor.StageScope.of(`scope${i}`), 1_024);
  operations("StructuralDebt", Doctor.StructuralDebt, (i) =>
    Doctor.StructuralObservation.of(artifact(i), Doctor.FindingCount.of(i)),
  );
  operations("StableReleases", Doctor.StableReleases, (i) => Doctor.PluginVersion.of(`1.0.${i}`), 10_000);

  test("InstallationManifest: 標準台帳は独立したManifestEntryの値で検索できる", () => {
    const manifest = Doctor.InstallationManifest.standard();
    const first = Doctor.ManifestEntry.error(ArtifactPath.of("sensors/aidlc-deep-spec-ir-valid.md"));
    expect(manifest.include(first)).toBe(true);
    expect(manifest.include(Doctor.ManifestEntry.error(ArtifactPath.of("missing.md")))).toBe(false);
    expect(manifest.tail().include(first)).toBe(false);
    expect(
      manifest
        .filter((entry) => entry.equals(first))
        .head()
        .equals(first),
    ).toBe(true);
  });

  test("未走査と0件、同じ成果物の取得場所違いを同値にしない", () => {
    const unscanned = Doctor.StructuralObservation.unavailable(artifact(1), ErrorMessage.of("backend unavailable"));
    expect(
      unscanned.equals(Doctor.StructuralObservation.unavailable(artifact(1), ErrorMessage.of("backend unavailable"))),
    ).toBe(true);
    expect(unscanned.equals(Doctor.StructuralObservation.of(artifact(1), Doctor.FindingCount.of(0)))).toBe(false);
    expect(Doctor.StructuralObservation.of(artifact(1), Doctor.FindingCount.of(0)).equals(unscanned)).toBe(false);
    expect(artifact(1).equals(artifact(2))).toBe(false);
    expect(
      Doctor.Check.of({ pass: true, label: "same", severity: Doctor.CheckSeverity.error() }).equals(
        Doctor.Check.of({ pass: true, label: "same", severity: Doctor.CheckSeverity.advisory() }),
      ),
    ).toBe(false);
  });
});

describe("複合要素が持つ状態の等価性", () => {
  test("数値の診断宣言も反射律を保ち、文字列・数値を混同しない", () => {
    expect(attribute(1, Number.NaN).equals(attribute(1, Number.NaN))).toBe(true);
    expect(attribute(1, Number.NaN).equals(attribute(1, "NaN"))).toBe(false);
    expect(attribute(1, -0).equals(attribute(1, 0))).toBe(true);
    expect(attribute(1, 1).equals(attribute(1, 2))).toBe(false);
  });

  test("属性宣言の欠落状態と実値、列挙の順序を区別する", () => {
    const absent = () =>
      Reference.AttributeDeclaration.of({
        name: attributeName(1),
        element: path(1),
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
    expect(absent().equals(absent())).toBe(true);
    expect(absent().equals(attribute(1))).toBe(false);
    expect(attribute(1).equals(absent())).toBe(false);
    const withAllowed = (values: readonly string[]) =>
      Reference.AttributeDeclaration.of({
        name: attributeName(1),
        element: path(1),
        type: null,
        uniqueIsTrue: false,
        references: null,
        allowed: Reference.AllowedValues.of(values.map(Reference.AllowedValue.of)),
        def: null,
        minDeclared: false,
        maxDeclared: false,
        min: null,
        max: null,
      });
    expect(withAllowed(["open", "closed"]).equals(withAllowed(["closed", "open"]))).toBe(false);
    expect(withAllowed([]).equals(withAllowed(["open"]))).toBe(false);
  });

  test("状態図の認識不能理由と宣言された状態図を混同しない", () => {
    const unknown = () => Reference.StateMachineSketch.unrecognized(line(1), ErrorMessage.of("missing states"));
    const declared = () =>
      Reference.StateMachineSketch.of({
        spec: Reference.MachineSpecification.of("Account.status"),
        states: Reference.StateNames.of([Reference.StateName.of("open")]),
        fenceLine: line(1),
        unsupported: null,
      });
    expect(unknown().equals(unknown())).toBe(true);
    expect(
      unknown().equals(Reference.StateMachineSketch.unrecognized(line(1), ErrorMessage.of("invalid diagram"))),
    ).toBe(false);
    expect(unknown().equals(declared())).toBe(false);
    expect(declared().equals(unknown())).toBe(false);
    expect(declared().equals(declared())).toBe(true);
  });

  test("索引のtail/filterはユニットごとの宣言と検索結果を保つ", () => {
    const index = Reference.SiblingUnitIndex.of(
      KeyedIndex.of([
        [UnitName.of("u1"), Reference.EntityDeclarations.of([entity(1)])],
        [UnitName.of("u2"), Reference.EntityDeclarations.of([entity(1)])],
      ]),
    );
    const entry = (unit: string) =>
      Reference.SiblingUnitIndexEntry.of(UnitName.of(unit), Reference.EntityDeclarations.of([entity(1)]));
    expect(index.include(entry("u1"))).toBe(true);
    expect(index.include(entry("absent"))).toBe(false);
    expect(index.tail().head().equals(entry("u2"))).toBe(true);
    expect(index.tail().entityDeclaredIn(UnitName.of("u1"), name(1).normalized())).toBeUndefined();
    expect(index.tail().entityDeclaredIn(UnitName.of("u2"), name(1).normalized())?.equals(entity(1))).toBe(true);
    expect(index.filter((item) => item.unit().equals(UnitName.of("u1"))).include(entry("u2"))).toBe(false);
    expect(index.filter(() => false).hasAnyUnit()).toBe(false);
    expect(
      index
        .definersOf(name(1).normalized())
        .toArray()
        .map((unit) => unit.asString()),
    ).toEqual(["u1", "u2"]);
  });
});
