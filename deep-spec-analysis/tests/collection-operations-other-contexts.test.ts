import { describe, expect, test } from "bun:test";
import { InstallationManifest } from "@deep-spec-analysis/doctor-domain";
import {
  AttributeKind,
  AttributePath,
  BackendName,
  FunctionalRequirementReferences,
  ImmutableFirstClassCollection,
  KeyedIndex,
  QueryLabel,
  RequirementIdentifier,
  ScenarioBindings,
  ScenarioExpectation,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import {
  AllowedValue,
  AllowedValues,
  AttributeDeclarations,
  ElementPath,
  EntityDeclaration,
  EntityDeclarations,
  EntityName,
  RelationshipDeclarations,
  SiblingUnitIndex,
} from "@deep-spec-analysis/refcheck-domain";
import {
  BackgroundAssumption,
  BackgroundAssumptionIdentifier,
  CrossCheckedEntry,
  FunctionalRequirementReferenceClaim,
  FunctionalRequirementReferenceClaims,
  FunctionalRequirementReferenceIndex,
  IntermediateRepresentationAttributeCatalog,
  IntermediateRepresentationAttributeDeclaration,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationAttributeEntry,
  IntermediateRepresentationAttributeName,
  IntermediateRepresentationEntityDeclaration,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationEntityName,
  IntermediateRepresentationObligationDeclaration,
  IntermediateRepresentationTemporalDeclaration,
  ObligationIdentifier,
  QuintMachineComponent,
  QuintMachineComponents,
  SatisfiabilityModuloTheoriesEventPairProbe,
  SatisfiabilityModuloTheoriesQueryVerdict,
  SatisfiabilityModuloTheoriesQueryVerdictEntry,
  SatisfiabilityModuloTheoriesQueryVerdicts,
  Scenario,
  ScenarioIdentifier,
  TraceState,
  TraceStateEntry,
  TraceValue,
  VerificationSkipped,
} from "@deep-spec-analysis/requirements-domain";

describe("他コンテキストの共通コレクション操作", () => {
  test("requirements要素は別instanceの同値と意味の違いを判定する", () => {
    const background = BackgroundAssumption.of({
      id: BackgroundAssumptionIdentifier.of("BG-1"),
      assert: { op: "bool", value: true },
    });
    expect(
      background.equals(
        BackgroundAssumption.of({ id: BackgroundAssumptionIdentifier.of("BG-1"), assert: { op: "bool", value: true } }),
      ),
    ).toBe(true);
    expect(
      background.equals(
        BackgroundAssumption.of({
          id: BackgroundAssumptionIdentifier.of("BG-1"),
          assert: { op: "bool", value: false },
        }),
      ),
    ).toBe(false);

    const crossChecked = CrossCheckedEntry.of({
      backend: BackendName.of("smt"),
      targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]),
    });
    expect(
      crossChecked.equals(
        CrossCheckedEntry.of({
          backend: BackendName.of("smt"),
          targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]),
        }),
      ),
    ).toBe(true);
    expect(
      crossChecked.equals(
        CrossCheckedEntry.of({
          backend: BackendName.of("quint"),
          targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]),
        }),
      ),
    ).toBe(false);

    const temporal = IntermediateRepresentationTemporalDeclaration.of({ assert: { op: "bool", value: true } });
    const obligation = IntermediateRepresentationObligationDeclaration.of({
      id: ObligationIdentifier.of("OB-1"),
      assert: { op: "bool", value: true },
      temporal,
    });
    expect(
      obligation.equals(
        IntermediateRepresentationObligationDeclaration.of({
          id: ObligationIdentifier.of("OB-1"),
          assert: { op: "bool", value: true },
          temporal: IntermediateRepresentationTemporalDeclaration.of({ assert: { op: "bool", value: true } }),
        }),
      ),
    ).toBe(true);
    expect(
      obligation.equals(
        IntermediateRepresentationObligationDeclaration.of({
          id: ObligationIdentifier.of("OB-1"),
          assert: { op: "bool", value: false },
        }),
      ),
    ).toBe(false);

    const scenario = Scenario.of({
      id: ScenarioIdentifier.of("SC-1"),
      expectation: ScenarioExpectation.of("accept"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      bindings: ScenarioBindings.of([]),
    });
    expect(
      scenario.equals(
        Scenario.of({
          id: ScenarioIdentifier.of("SC-1"),
          expectation: ScenarioExpectation.of("accept"),
          functionalRequirementReferences: FunctionalRequirementReferences.of([]),
          bindings: ScenarioBindings.of([]),
        }),
      ),
    ).toBe(true);
    expect(
      scenario.equals(
        Scenario.of({
          id: ScenarioIdentifier.of("SC-1"),
          expectation: ScenarioExpectation.of("reject"),
          functionalRequirementReferences: FunctionalRequirementReferences.of([]),
          bindings: ScenarioBindings.of([]),
        }),
      ),
    ).toBe(false);
  });

  test("requirements要素の識別値を持つVO/Entityは順序操作でその同値を利用する", () => {
    const component = QuintMachineComponent.of({
      id: ObligationIdentifier.of("OB-1"),
      expression: { op: "bool", value: true },
    });
    const components = QuintMachineComponents.of([component]);
    expect(
      components.include(
        QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: { op: "bool", value: true } }),
      ),
    ).toBe(true);
    expect(components.filter(() => true)).toBeInstanceOf(QuintMachineComponents);

    const probe = SatisfiabilityModuloTheoriesEventPairProbe.of({
      qOverlap: QueryLabel.of("q:overlap"),
      qJoint: QueryLabel.of("q:joint"),
      a: ObligationIdentifier.of("OB-1"),
      b: ObligationIdentifier.of("OB-2"),
      trigger: TriggerName.of("submit"),
    });
    expect(
      probe.equals(
        SatisfiabilityModuloTheoriesEventPairProbe.of({
          qOverlap: QueryLabel.of("q:overlap"),
          qJoint: QueryLabel.of("q:joint"),
          a: ObligationIdentifier.of("OB-1"),
          b: ObligationIdentifier.of("OB-2"),
          trigger: TriggerName.of("submit"),
        }),
      ),
    ).toBe(true);

    const skipped = VerificationSkipped.of({
      target: TargetIdentifier.of("OB-1"),
      reason: SkipReason.timeout(),
      detail: "x",
    });
    expect(
      skipped.equals(
        VerificationSkipped.of({ target: TargetIdentifier.of("OB-1"), reason: SkipReason.timeout(), detail: "x" }),
      ),
    ).toBe(true);
    expect(
      skipped.equals(
        VerificationSkipped.of({ target: TargetIdentifier.of("OB-1"), reason: SkipReason.capability(), detail: "x" }),
      ),
    ).toBe(false);
  });
  test("at/head は空・範囲外を拒否し、tail/filter は具体コレクションを保つ", () => {
    const active = AllowedValue.of("active");
    const closed = AllowedValue.of("closed");
    const values = AllowedValues.of([active, closed]);

    expect(values.head()).toBe(active);
    expect(values.at(1)).toBe(closed);
    expect(() => AllowedValues.of([]).head()).toThrow();
    expect(() => values.at(-1)).toThrow();
    expect(() => values.at(2)).toThrow();

    const tail = values.tail();
    const filtered = values.filter((value) => value.equals(active));
    expect(tail).toBeInstanceOf(AllowedValues);
    expect(filtered).toBeInstanceOf(AllowedValues);
    expect([...tail]).toEqual([closed]);
    expect([...filtered]).toEqual([active]);
  });

  test("include は別インスタンスの等価要素を受理し、exists は短絡する", () => {
    const values = AllowedValues.of([AllowedValue.of("active"), AllowedValue.of("closed")]);
    expect(values.include(AllowedValue.of("active"))).toBe(true);
    expect(values.include(AllowedValue.of("missing"))).toBe(false);

    let inspected = 0;
    expect(
      values.exists((value) => {
        inspected++;
        return value.asString() === "active";
      }),
    ).toBe(true);
    expect(inspected).toBe(1);
  });

  test("map は別の値オブジェクトを受け取り汎用不変コレクションを返す", () => {
    const mapped = AllowedValues.of([AllowedValue.of("active")]).map((value) =>
      TargetIdentifier.of(`state:${value.asString()}`),
    );
    expect(mapped).toBeInstanceOf(ImmutableFirstClassCollection);
    expect([...mapped].map((value) => value.asString())).toEqual(["state:active"]);
  });

  test("入力配列を変更しても所有要素と派生コレクションは変わらない", () => {
    const source = [AllowedValue.of("active"), AllowedValue.of("closed")];
    const values = AllowedValues.of(source);
    source.splice(0, source.length, AllowedValue.of("changed"));
    const tail = values.tail();
    const filtered = values.filter(() => true);
    expect([...values].map((value) => value.asString())).toEqual(["active", "closed"]);
    expect([...tail].map((value) => value.asString())).toEqual(["closed"]);
    expect([...filtered].map((value) => value.asString())).toEqual(["active", "closed"]);
  });
});

describe("KeyedIndex を使うコレクションの操作", () => {
  test("FR参照claim/indexは件数上限をofの例外とparseのResultで同じく守る", () => {
    const claim = FunctionalRequirementReferenceClaim.of(
      "OB-1",
      FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]),
    );
    const oversized = Array.from({ length: 65_537 }, () => claim);
    expect(() => FunctionalRequirementReferenceClaims.of(oversized)).toThrow();
    const claimsParsed = FunctionalRequirementReferenceClaims.parse(oversized);
    expect(claimsParsed.ok).toBe(false);
    expect(() => FunctionalRequirementReferenceIndex.of(oversized)).toThrow();
    const indexParsed = FunctionalRequirementReferenceIndex.parse(oversized);
    expect(indexParsed.ok).toBe(false);
  });

  test("FR参照claim/indexは別instanceの等価要素を受理し、具体型を再構築する", () => {
    const references = FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]);
    const claim = FunctionalRequirementReferenceClaim.of("OB-1", references);
    const equivalent = FunctionalRequirementReferenceClaim.of(
      "OB-1",
      FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]),
    );
    const claims = FunctionalRequirementReferenceClaims.of([claim]);
    const index = FunctionalRequirementReferenceIndex.of([claim]);
    expect(claims.include(equivalent)).toBe(true);
    expect(claims.filter(() => true)).toBeInstanceOf(FunctionalRequirementReferenceClaims);
    expect(index.include(equivalent)).toBe(true);
    expect(index.filter(() => true)).toBeInstanceOf(FunctionalRequirementReferenceIndex);
    expect([...index]).toEqual([claim]);
  });

  test("SMT QueryVerdicts は QueryLabel と verdict の組を反復し、キーを保持する", () => {
    const verdict = SatisfiabilityModuloTheoriesQueryVerdict.of({ status: "sat" });
    const first = QueryLabel.of("q:first");
    const second = QueryLabel.of("q:second");
    const values = SatisfiabilityModuloTheoriesQueryVerdicts.of([
      SatisfiabilityModuloTheoriesQueryVerdictEntry.of(first, verdict),
      SatisfiabilityModuloTheoriesQueryVerdictEntry.of(second, verdict),
    ]);
    const entries = values.toArray();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.query().asString())).toEqual(["q:first", "q:second"]);
    expect(entries.every((entry) => entry.verdict() === verdict)).toBe(true);
    expect(values.head()).toBe(entries[0]);
    expect(values.head()).toBeInstanceOf(SatisfiabilityModuloTheoriesQueryVerdictEntry);
    expect([...values.tail()]).toHaveLength(1);
  });

  test("TraceState は同じ値でも AttributePath ごとの Entry を失わない", () => {
    const value = TraceValue.of(true);
    const first = AttributePath.of("Account.active");
    const second = AttributePath.of("Account.enabled");
    const state = TraceState.of([TraceStateEntry.of(first, value), TraceStateEntry.of(second, value)]);
    expect(state.toArray()).toHaveLength(2);
    const entries = state.toArray();
    expect(entries.map((entry) => entry.path().asString())).toEqual(["Account.active", "Account.enabled"]);
    expect(state.head()).toBe(entries[0]);
    expect(state.toArray().every((entry) => entry.value() === value)).toBe(true);
    expect(state.filter((entry) => entry.path().equals(first)).toArray()).toHaveLength(1);
    expect(state.tail().head()).toBe(entries[1]);
    expect(state.include(TraceStateEntry.of(first, TraceValue.of(true)))).toBe(true);
  });

  test("SiblingUnitIndex は同じ EntityDeclaration を unit ごとに識別する", () => {
    const entity = EntityDeclaration.of({
      name: EntityName.of("Account"),
      element: ElementPath.of("entities[0]"),
      attrs: AttributeDeclarations.of([]),
      rels: RelationshipDeclarations.of([]),
    });
    const first = UnitName.of("u1");
    const second = UnitName.of("u2");
    const index = SiblingUnitIndex.of(
      KeyedIndex.of([
        [first, EntityDeclarations.of([entity])],
        [second, EntityDeclarations.of([entity])],
      ]),
    );
    const entries = index.toArray();
    expect(entries.map((entry) => entry.unit().asString())).toEqual(["u1", "u2"]);
    expect(entries.every((entry) => entry.declarations().toArray()[0] === entity)).toBe(true);
    expect(
      index
        .definersOf(entity.name().normalized())
        .toArray()
        .map((unit) => unit.asString()),
    ).toEqual(["u1", "u2"]);
    expect(index.filter((entry) => entry.unit().equals(first)).head()).toBe(entries[0]);
  });

  test("IR 属性カタログは同じ宣言を異なる owner 座標で保持する", () => {
    const attribute = IntermediateRepresentationAttributeDeclaration.of({
      name: IntermediateRepresentationAttributeName.of("active"),
      kind: AttributeKind.of("bool"),
    });
    const entities = IntermediateRepresentationEntityDeclarations.of([
      IntermediateRepresentationEntityDeclaration.of({
        name: IntermediateRepresentationEntityName.of("Account"),
        attributes: IntermediateRepresentationAttributeDeclarations.of([attribute]),
      }),
      IntermediateRepresentationEntityDeclaration.of({
        name: IntermediateRepresentationEntityName.of("User"),
        attributes: IntermediateRepresentationAttributeDeclarations.of([attribute]),
      }),
    ]);
    const catalog = IntermediateRepresentationAttributeCatalog.of(entities);
    const parsedEntry = IntermediateRepresentationAttributeEntry.parse(
      IntermediateRepresentationEntityName.of("Account"),
      attribute,
    );
    expect(parsedEntry.ok).toBe(true);
    if (parsedEntry.ok) expect(parsedEntry.value.path().asString()).toBe("Account.active");
    expect(catalog.toArray().map((entry) => entry.owner().asString())).toEqual(["Account", "User"]);
    expect(catalog.toArray().map((entry) => entry.path().asString())).toEqual(["Account.active", "User.active"]);
    expect(catalog.filter((entry) => entry.owner().asString() === "User").head()).toBe(catalog.toArray()[1]);
  });
});

describe("非空コレクション", () => {
  test("InstallationManifest は標準台帳を偽造せず tail/filter を一般コレクションへ返す", () => {
    const manifest = InstallationManifest.standard();
    expect("isEmpty" in manifest).toBe(false);
    expect(manifest.head().rel()).toContain("sensors/");
    const tail = manifest.tail();
    const filtered = manifest.filter(() => false);
    expect(tail).toBeInstanceOf(ImmutableFirstClassCollection);
    expect(filtered).toBeInstanceOf(ImmutableFirstClassCollection);
    expect(filtered.isEmpty()).toBe(true);
    expect([...manifest].length).toBe(26);
  });
});
