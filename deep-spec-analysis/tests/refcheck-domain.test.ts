import {
  ContentHash,
  FindingKind,
  FunctionalRequirementReferences,
  RequirementIdentifier,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec/kernel-domain";

// refcheck/domain の単体テスト（DDD 移行 PR2a、issue #15）。
// カタログ順序は golden バイトを決める凍結挙動——順位・タイブレークを固定する。

import { describe, expect, test } from "bun:test";

import {
  AllowedValue,
  AllowedValues,
  AppliesTo,
  AttributeDeclaration,
  AttributeDeclarations,
  AttributeDefault,
  AttributeName,
  AttributeNames,
  BlockIndex,
  BusinessRuleIdentifier,
  CATALOG_VERSION,
  CardinalityNotation,
  CheckFamilies,
  CheckFamily,
  Component,
  ComponentEntities,
  ComponentEntity,
  ComponentName,
  ComponentReference,
  ComponentReferences,
  ComponentShapeError,
  ComponentShapeErrors,
  Components,
  ContractIdentifier,
  ContractParty,
  ContractRow,
  ContractRows,
  DomainEntitySketch,
  DomainEntitySketches,
  ElementPath,
  EntityDeclaration,
  EntityDeclarations,
  EntityName,
  EntityReference,
  EntityReferences,
  Finding,
  Findings,
  InputAnchor,
  InputAnchors,
  LineNumber,
  MachineSpecification,
  NumericBound,
  ReferenceTarget,
  RelationshipDeclaration,
  RelationshipDeclarations,
  RuleCategory,
  RuleDeclaration,
  RuleDeclarations,
  ShapeError,
  ShapeErrors,
  SiblingUnitIndex,
  Skipped,
  Skips,
  SourceIdentifier,
  SourceIdentifiers,
  SpecificationBlockAssessment,
  SpecificationBlockAssessments,
  StateMachineSketch,
  StateMachineSketches,
  StateName,
  StateNames,
  TypeName,
  UnitDeclaration,
  UnitDeclarations,
  UnitName,
  UnitNames,
  WitnessReference,
  WitnessReferences,
} from "@deep-spec/refcheck-domain";

function finding(kind: string, targets: string[], detail: string): Finding {
  return Finding.of({
    kind: FindingKind.of(kind),
    functionalRequirementReferences: FunctionalRequirementReferences.of([]),
    targets: TargetIdentifiers.of(Array.from(targets, (raw) => TargetIdentifier.of(raw))),
    witness: { refs: WitnessReferences.of([]) },
    detail,
  });
}

describe("catalog-order", () => {
  test("findings sort by the extended kind rank, then joined targets, then detail", () => {
    const sorted = Findings.of([
      finding("cross-check-disagreement", ["SC-1"], "z"),
      finding("structure-invalid", ["check:DD-0"], "b"),
      finding("structure-invalid", ["check:DD-0"], "a"),
      finding("reference-broken", ["component:A"], "x"),
      finding("conflict", ["OB-9"], "y"),
    ])
      .sortedCanonically()
      .toArray();
    expect(sorted.map((f) => `${f.kind()}/${f.detail()}`)).toEqual([
      "conflict/y",
      "structure-invalid/a",
      "structure-invalid/b",
      "reference-broken/x",
      "cross-check-disagreement/z",
    ]);
  });

  test("unknown kinds fail construction without becoming findings", () => {
    const result = FindingKind.parse("mystery-kind");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.raw).toBe("mystery-kind");
  });

  test("prototype names cannot enter the closed finding-kind vocabulary", () => {
    for (const raw of ["toString", "constructor", "__proto__"]) {
      expect(FindingKind.parse(raw).ok).toBe(false);
    }
  });

  test("skips sort by id order on target, then by reason", () => {
    const skips: Skipped[] = [
      Skipped.of({ target: TargetIdentifier.of("check:FD-E10"), reason: SkipReason.waived() }),
      Skipped.of({ target: TargetIdentifier.of("check:FD-E2"), reason: SkipReason.timeout() }),
      Skipped.of({ target: TargetIdentifier.of("check:FD-E2"), reason: SkipReason.capability() }),
    ];
    expect(
      Skips.of(skips)
        .sortedCanonically()
        .toArray()
        .map((s) => `${s.target()}/${s.reason()}`),
    ).toEqual(["check:FD-E2/capability", "check:FD-E2/timeout", "check:FD-E10/waived"]);
  });

  test("the catalog version pins the contract line refcheck documents declare", () => {
    expect(CATALOG_VERSION).toBe("1.0.0");
  });
});

// of は契約違反を送出し、parse は同じ違反を Result に変換する。

describe("functional-design vocabulary domain primitives", () => {
  test("token DPs: parse rejects the empty string, of constructs valid values, equals is by value", () => {
    const cases: { parse: (raw: string) => { ok: boolean } }[] = [
      EntityName,
      AttributeName,
      ElementPath,
      TypeName,
      AllowedValue,
      CardinalityNotation,
      RuleCategory,
      AppliesTo,
      SourceIdentifier,
      MachineSpecification,
      StateName,
      ComponentName,
      ReferenceTarget,
    ];
    for (const dp of cases) {
      const bad = dp.parse("");
      expect(bad.ok).toBe(false);
      const good = dp.parse("Order");
      expect(good.ok).toBe(true);
      expect(dp.parse("x").ok).toBe(true);
    }
    expect(EntityName.of("A").equals(EntityName.of("A"))).toBe(true);
    expect(AttributeName.of("a").equals(AttributeName.of("b"))).toBe(false);
    expect(ElementPath.of("e[0]").equals(ElementPath.of("e[0]"))).toBe(true);
    expect(TypeName.of("t").equals(TypeName.of("t"))).toBe(true);
    expect(AllowedValue.of("v").equals(AllowedValue.of("w"))).toBe(false);
    expect(CardinalityNotation.of("1:1").equals(CardinalityNotation.of("1:1"))).toBe(true);
    expect(RuleCategory.of("c").equals(RuleCategory.of("c"))).toBe(true);
    expect(AppliesTo.of("A").equals(AppliesTo.of("B"))).toBe(false);
    expect(SourceIdentifier.of("FR-1").equals(SourceIdentifier.of("FR-1"))).toBe(true);
    expect(StateName.of("s").equals(StateName.of("s"))).toBe(true);
    expect(ComponentName.of("C").equals(ComponentName.of("D"))).toBe(false);
    expect(ReferenceTarget.of("R").equals(ReferenceTarget.of("R"))).toBe(true);
    expect(MachineSpecification.of("m").equals(MachineSpecification.of("m"))).toBe(true);
  });

  test("interpretation vocabulary: normalization, shape, spec decomposition, defaults, bounds", () => {
    expect(EntityName.of("Order Item").normalized().equals(StateName.of("order_item").normalized())).toBe(true);
    expect(TypeName.of("Decimal").normalized()).toBe("decimal");
    expect(CardinalityNotation.of(" 1 : n ").normalizedToken()).toBe("1:N");
    expect(BusinessRuleIdentifier.of("BR1.2").matchesShape()).toBe(true);
    expect(BusinessRuleIdentifier.parse("BRX").ok).toBe(false);
    expect(BusinessRuleIdentifier.parse("BR1.2").ok).toBe(true);
    expect(BusinessRuleIdentifier.parse("nope").ok).toBe(false);
    expect(BusinessRuleIdentifier.of("BR1.2").equals(BusinessRuleIdentifier.of("BR1.2"))).toBe(true);
    expect(BusinessRuleIdentifier.of("BR1.2").asString()).toBe("BR1.2");
    expect(RuleCategory.of("Validation").normalized()).toBe("validation");
    expect(AttributeName.of("Status").normalized().asString()).toBe("status");
    expect(AllowedValue.of("Open").normalized().asString()).toBe("open");

    const spec = MachineSpecification.of("Order.status");
    expect(spec.entityToken().asString()).toBe("Order");
    expect(spec.attributeToken()).toBe("status");
    expect(MachineSpecification.of("Order").attributeToken()).toBe(undefined);
    expect(spec.asString()).toBe("Order.status");

    const numDef = AttributeDefault.of(5);
    expect(numDef.isNumber()).toBe(true);
    expect(numDef.isString()).toBe(false);
    expect(numDef.asNumber()).toBe(5);
    expect(numDef.render()).toBe("5");
    const strDef = AttributeDefault.of("open");
    expect(strDef.isString()).toBe(true);
    expect(strDef.asString()).toBe("open");
    expect(strDef.render()).toBe("open");

    expect(NumericBound.parse(3).ok).toBe(true);
    expect(NumericBound.parse(Number.NaN).ok).toBe(false);
    expect(NumericBound.of(3).asNumber()).toBe(3);
    expect(NumericBound.of(3).equals(NumericBound.of(3))).toBe(true);
    expect(ReferenceTarget.of("Order.id").asString()).toBe("Order.id");
    expect(ElementPath.of("entities[0]").asString()).toBe("entities[0]");
    expect(SourceIdentifier.of("FR-1").asString()).toBe("FR-1");
    expect(AppliesTo.of("Order").asString()).toBe("Order");
    expect(ComponentName.of("Core").asString()).toBe("Core");
  });
});

// ファーストクラスコレクション — 不変の追加・巡回・境界脱出口・集合知識の分岐網羅。

describe("first-class collections", () => {
  const attr = (name: string, allowed: string[] | null = null): AttributeDeclaration =>
    AttributeDeclaration.of({
      name: AttributeName.of(name),
      element: ElementPath.of(`e.${name}`),
      type: null,
      uniqueIsTrue: false,
      references: null,
      allowed: allowed === null ? null : AllowedValues.of(allowed.map((v) => AllowedValue.of(v))),
      def: null,
      minDeclared: false,
      maxDeclared: false,
      min: null,
      max: null,
    });
  const entity = (name: string, attrs: AttributeDeclaration[] = []): EntityDeclaration =>
    EntityDeclaration.of({
      name: EntityName.of(name),
      element: ElementPath.of(`entities.${name}`),
      attrs: AttributeDeclarations.of(attrs),
      rels: RelationshipDeclarations.of([]),
    });

  test("add is immutable append across every collection", () => {
    const names = AttributeNames.of([]);
    expect(names.count()).toBe(0);
    expect(names.add(AttributeName.of("qty")).count()).toBe(1);
    expect(names.count()).toBe(0);

    expect([...AllowedValues.of([]).add(AllowedValue.of("open"))].length).toBe(1);
    expect([...StateNames.of([]).add(StateName.of("open"))].length).toBe(1);
    expect(SourceIdentifiers.of([]).add(SourceIdentifier.of("FR-1")).toArray().length).toBe(1);
    expect(AttributeDeclarations.of([]).add(attr("a")).toArray().length).toBe(1);
    expect(EntityDeclarations.of([]).add(entity("Order")).toArray().length).toBe(1);
    expect(
      [
        ...RelationshipDeclarations.of([]).add(
          RelationshipDeclaration.of({
            element: ElementPath.of("r[0]"),
            from: null,
            to: null,
            cardinality: null,
            hasDirection: false,
          }),
        ),
      ].length,
    ).toBe(1);
    expect(
      RuleDeclarations.of([])
        .add(
          RuleDeclaration.of({
            id: null,
            element: ElementPath.of("rules[0]"),
            category: null,
            appliesTo: null,
            sourceIds: SourceIdentifiers.of([]),
            missing: [],
          }),
        )
        .toArray().length,
    ).toBe(1);
    expect(
      ShapeErrors.of([])
        .add(ShapeError.of({ element: ElementPath.of("entities"), detail: "x" }))
        .toArray().length,
    ).toBe(1);
    const sketch = StateMachineSketch.of({
      spec: MachineSpecification.of("Order"),
      states: StateNames.of([]),
      fenceLine: LineNumber.of(1),
      unsupported: null,
    });
    expect(StateMachineSketches.of([]).add(sketch).isEmpty()).toBe(false);
    const de = DomainEntitySketch.of({
      name: EntityName.of("Order"),
      component: ComponentName.of("Core"),
      attributes: AttributeNames.of([]),
    });
    expect(DomainEntitySketches.of([]).add(de).toArray().length).toBe(1);
  });

  test("collection-owned set knowledge: names, duplicates, membership, index lookups", () => {
    const attrs = AttributeDeclarations.of([attr("status", ["open"]), attr("qty"), attr("status")]);
    expect(attrs.names().map((n) => n.asString())).toEqual(["status", "qty", "status"]);
    expect(attrs.duplicatesByName().map((a) => a.name().asString())).toEqual(["status"]);
    expect(attrs.named("qty")?.name().asString()).toBe("qty");
    expect(attrs.lifecycleAttr()?.name().asString()).toBe("status");

    const decls = EntityDeclarations.of([entity("Order"), entity("Order")]);
    expect(decls.duplicatesByName().length).toBe(1);
    expect(decls.containsNamed(EntityName.of("Order"))).toBe(true);
    expect(decls.containsNamed(EntityName.of("Ghost"))).toBe(false);

    const rels = RelationshipDeclarations.of([]).concat(
      RelationshipDeclarations.of([
        RelationshipDeclaration.of({
          element: ElementPath.of("r[0]"),
          from: null,
          to: null,
          cardinality: null,
          hasDirection: true,
        }),
      ]),
    );
    expect(rels.toArray().length).toBe(1);

    const index = SiblingUnitIndex.of(
      new Map([
        [
          "u1",
          new Map([["order", { name: EntityName.of("Order"), attrs: AttributeNames.of([AttributeName.of("qty")]) }]]),
        ],
      ]),
    );
    expect(index.hasAnyUnit()).toBe(true);
    expect(index.definersOf("order")).toEqual(["u1"]);
    expect(index.entityDeclaredIn("u1", "order")?.name.asString()).toBe("Order");
    expect(index.entityDeclaredIn("u9", "order")).toBe(undefined);
    expect(SiblingUnitIndex.of(new Map()).hasAnyUnit()).toBe(false);

    const sketches = DomainEntitySketches.of([
      DomainEntitySketch.of({
        name: EntityName.of("Order"),
        component: ComponentName.of("Core"),
        attributes: AttributeNames.of([]),
      }),
      DomainEntitySketch.of({
        name: EntityName.of("order"),
        component: ComponentName.of("Core"),
        attributes: AttributeNames.of([]),
      }),
    ]);
    expect(sketches.sortedDistinctByNormalizedName().length).toBe(1);
  });
});

describe("refcheck thorough DP/collection surfaces (owner ruling)", () => {
  test("CheckFamily parses strictly, renders its frozen wordings, and compares by value", () => {
    expect(CheckFamily.parse("").ok).toBe(false);
    const dd = CheckFamily.parse("DD-1");
    if (!dd.ok) throw new Error("unreachable");
    expect(dd.value.asString()).toBe("DD-1");
    expect(dd.value.equals(CheckFamily.of("DD-1"))).toBe(true);
    expect(dd.value.prefixedDetail("boom")).toBe("DD-1: boom");
    expect(dd.value.asCheckTarget()).toBe("check:DD-1");
  });

  test("CheckFamilies carries its check targets in declaration order under add", () => {
    const fams = CheckFamilies.of(Array.from(["A-1"], (raw) => CheckFamily.of(raw)))
      .add(CheckFamily.of("A-2"))
      .add(CheckFamily.of("A-3"));
    expect([...fams].map((f) => f.asString())).toEqual(["A-1", "A-2", "A-3"]);
    expect(fams.toArray().length).toBe(3);
    expect(fams.checkTargets().toStrings()).toEqual(["check:A-1", "check:A-2", "check:A-3"]);
  });

  test("UnitName and UnitNames carry declaration knowledge", () => {
    expect(UnitName.parse("").ok).toBe(false);
    const u = UnitName.parse("cart");
    if (!u.ok) throw new Error("unreachable");
    expect(u.value.equals(UnitName.of("cart"))).toBe(true);
    const names = UnitNames.of(Array.from(["b"], (raw) => UnitName.of(raw))).add(UnitName.of("a"));
    expect(names.declares("a")).toBe(true);
    expect(names.declares("z")).toBe(false);
    expect([...names.sortedByValue()].map((n) => n.asString())).toEqual(["a", "b"]);
    expect(names.toArray().length).toBe(2);
  });

  test("LineNumber and BlockIndex reject non-positive locations and rehydrate verbatim", () => {
    expect(LineNumber.parse(0).ok).toBe(false);
    expect(BlockIndex.parse(-1).ok).toBe(false);
    const ln = LineNumber.parse(7);
    if (!ln.ok) throw new Error("unreachable");
    expect(ln.value.asNumber()).toBe(7);
    expect(ln.value.equals(LineNumber.of(7))).toBe(true);
    const bi = BlockIndex.parse(2);
    if (!bi.ok) throw new Error("unreachable");
    expect(bi.value.equals(BlockIndex.of(2))).toBe(true);
  });

  test("ContractIdentifier, ContractParty and ContractRows own the CD vocabulary", () => {
    expect(ContractIdentifier.parse("").ok).toBe(false);
    const cid = ContractIdentifier.parse("3");
    if (!cid.ok) throw new Error("unreachable");
    expect(cid.value.equals(ContractIdentifier.of("3"))).toBe(true);
    expect(ContractParty.of("").isBlank()).toBe(true);
    expect(ContractParty.of("External: billing").declaresExternal()).toBe(true);
    expect(ContractParty.of("cart").declaresExternal()).toBe(false);
    expect(ContractParty.of("cart").equals(ContractParty.of("cart"))).toBe(true);
    const row = ContractRow.of({
      id: ContractIdentifier.of("1"),
      provider: ContractParty.of("cart"),
      consumer: ContractParty.of("billing"),
      owner: ContractParty.of("cart"),
      line: LineNumber.of(3),
    });
    expect(row.locationLabel()).toBe("contracts table row 1 (line 3)");
    expect(row.id().asString()).toBe("1");
    const rows = ContractRows.of([]).add(row);
    expect([...rows]).toEqual([row]);
    expect(rows.toArray()).toEqual([row]);
    expect(rows.coversEdge("cart", "billing")).toBe(true);
    expect(rows.coversEdge("billing", "cart")).toBe(true);
    expect(rows.coversEdge("cart", "ghost")).toBe(false);
  });

  test("UnitDeclarations and SpecificationBlockAssessments hold declaration and assessment knowledge", () => {
    const decl = UnitDeclaration.of({
      name: UnitName.of("b"),
      dependsOn: UnitNames.of(Array.from(["a", "ghost"], (raw) => UnitName.of(raw))),
    });
    const decls = UnitDeclarations.of([])
      .add(decl)
      .add(UnitDeclaration.of({ name: UnitName.of("a"), dependsOn: UnitNames.of([]) }));
    // 宣言済みの依存先だけを値順で（未宣言 "ghost" は落ちる）。
    expect(decl.declaredDependencies(decls).map((d) => d.asString())).toEqual(["a"]);
    expect(decl.dependsOn().toArray().length).toBe(2);
    expect(decls.declares("b")).toBe(true);
    expect(decls.declares("z")).toBe(false);
    expect([...decls.sortedByName()].map((d) => d.name().asString())).toEqual(["a", "b"]);
    expect(decls.names().declares("a")).toBe(true);
    expect(decls.toArray().length).toBe(2);
    const block = SpecificationBlockAssessment.sound(BlockIndex.of(1), LineNumber.of(1));
    expect(block.blockId()).toBe("contract:block-1");
    expect(block.locationLabel()).toBe("yaml fence #1 (line 1)");
    expect(
      block.matchIssue({
        sound: () => "ok",
        unparseable: () => "u",
        notAMapping: () => "m",
        openapiWithoutPaths: () => "o",
      }),
    ).toBe("ok");
    const blocks = SpecificationBlockAssessments.of([]).add(block);
    expect([...blocks]).toEqual([block]);
    expect(blocks.toArray()).toEqual([block]);
  });

  test("component collections resolve names, symmetry and cycles as their own knowledge", () => {
    const el = ElementPath.of("components[0]");
    const aName = ComponentName.of("A");
    const bName = ComponentName.of("B");
    const refAtoB = ComponentReference.of({ component: bName, element: el });
    const refBtoA = ComponentReference.of({ component: aName, element: el });
    const entity = ComponentEntity.of({
      name: EntityName.of("Order"),
      element: el,
      identifier: AttributeName.of("id"),
      references: EntityReferences.of([]).add(
        EntityReference.of({ entity: EntityName.of("Line"), ownedBy: bName, element: el }),
      ),
    });
    const a = Component.of({
      name: aName,
      element: el,
      dependsOn: ComponentReferences.of([refAtoB]),
      dependents: ComponentReferences.of([refBtoA]),
      entities: ComponentEntities.of([entity]),
    });
    const b = Component.of({
      name: bName,
      element: el,
      dependsOn: ComponentReferences.of([refBtoA]),
      dependents: ComponentReferences.of([]),
      entities: ComponentEntities.of([]),
    });
    const comps = Components.of([]).add(a).add(b);
    expect(comps.count()).toBe(2);
    expect([...comps].length).toBe(2);
    expect(comps.declares(aName)).toBe(true);
    expect(comps.declares(ComponentName.of("Z"))).toBe(false);
    expect(comps.byName(bName)).toBe(b);
    expect(comps.byName(ComponentName.of("Z"))).toBe(null);
    expect(a.name().asString()).toBe("A");
    expect(a.element().asString()).toBe("components[0]");
    expect(a.dependsOn().listsComponent(bName)).toBe(true);
    expect(a.dependsOn().toArray().length).toBe(1);
    expect([...a.dependsOn()].length).toBe(1);
    expect(a.dependsOn().add(refBtoA).toArray().length).toBe(2);
    expect(a.dependents().toArray().length).toBe(1);
    expect(a.entities().declaresEntity(EntityName.of("Order"))).toBe(true);
    expect(a.entities().declaresEntity(EntityName.of("Ghost"))).toBe(false);
    expect([...a.entities()].length).toBe(1);
    expect(a.entities().add(entity).toArray().length).toBe(2);
    expect(entity.name().asString()).toBe("Order");
    expect(entity.element().asString()).toBe("components[0]");
    expect([...entity.references()].length).toBe(1);
    expect(entity.references().toArray().length).toBe(1);
    expect(refAtoB.component().asString()).toBe("B");
    expect(refAtoB.element().asString()).toBe("components[0]");
    // A -> B -> A の閉路は正準化されて 1 件。
    expect(comps.dependencyCycles()).toEqual([["A", "B"]]);
    // 重複名の byName は最後の宣言が勝つ（旧 name→Component Map の凍結挙動）。
    const aDup = Component.of({
      name: aName,
      element: ElementPath.of("components[9]"),
      dependsOn: ComponentReferences.of([]),
      dependents: ComponentReferences.of([]),
      entities: ComponentEntities.of([]),
    });
    const withDup = comps.add(aDup);
    expect(withDup.byName(aName)?.element().asString()).toBe("components[9]");
    const errs = ComponentShapeErrors.of([]).add(ComponentShapeError.of({ element: el, detail: "x" }));
    expect(errs.toArray()[0]?.detail()).toBe("x");
    expect(errs.toArray()[0]?.element().asString()).toBe(el.asString());
    expect(errs.count()).toBe(1);
    expect([...errs].length).toBe(1);
  });

  test("components own their shape checks: PascalCase, duplicates, self-dependency, ownership (wave 6)", () => {
    const el = ElementPath.of("components[0]");
    const bare = (name: string, element: string): Component =>
      Component.of({
        name: ComponentName.of(name),
        element: ElementPath.of(element),
        dependsOn: ComponentReferences.of([]),
        dependents: ComponentReferences.of([]),
        entities: ComponentEntities.of([]),
      });

    // DD-1: PascalCase は宣言自身の判定。
    expect(bare("Order", "components[0]").nameIsPascalCase()).toBe(true);
    expect(bare("order", "components[0]").nameIsPascalCase()).toBe(false);

    // DD-1: 重複は直前の宣言との対（宣言順——3 度目は 2 度目と対になる）。
    const dups = Components.of([
      bare("A", "components[0]"),
      bare("B", "components[1]"),
      bare("A", "components[2]"),
      bare("A", "components[3]"),
    ]);
    expect(
      dups.duplicateNamePairs().map((p) => `${p.prior.element().asString()}→${p.current.element().asString()}`),
    ).toEqual(["components[0]→components[2]", "components[2]→components[3]"]);
    expect(Components.of([bare("A", "components[0]"), bare("B", "components[1]")]).duplicateNamePairs()).toEqual([]);

    // DD-3: 自己参照は depends_on → dependents の走査順で届く。
    const selfName = ComponentName.of("Self");
    const self = Component.of({
      name: selfName,
      element: el,
      dependsOn: ComponentReferences.of([
        ComponentReference.of({
          component: selfName,
          element: ElementPath.of("components[0].depends_on[0].component"),
        }),
      ]),
      dependents: ComponentReferences.of([
        ComponentReference.of({ component: ComponentName.of("Other"), element: el }),
        ComponentReference.of({
          component: selfName,
          element: ElementPath.of("components[0].dependents[1].component"),
        }),
      ]),
      entities: ComponentEntities.of([]),
    });
    expect(self.selfReferences().map((r) => r.element().asString())).toEqual([
      "components[0].depends_on[0].component",
      "components[0].dependents[1].component",
    ]);
    expect(bare("A", "components[0]").selfReferences()).toEqual([]);

    // DD-5: 識別子の有無はエンティティ自身の判定（未宣言・空文字は所有不能）。
    const entityOf = (identifier: string | null): ComponentEntity =>
      ComponentEntity.of({
        name: EntityName.of("Order"),
        element: el,
        identifier: identifier === null || identifier === "" ? null : AttributeName.of(identifier),
        references: EntityReferences.of([]),
      });
    expect(entityOf("id").hasIdentifier()).toBe(true);
    expect(entityOf(null).hasIdentifier()).toBe(false);
    expect(entityOf("").hasIdentifier()).toBe(false);

    // DD-5: 所有競合はエンティティ名昇順、所有側は宣言順——単一所有は届かない。
    const owner = (comp: string, element: string, entities: ComponentEntity[]): Component =>
      Component.of({
        name: ComponentName.of(comp),
        element: ElementPath.of(element),
        dependsOn: ComponentReferences.of([]),
        dependents: ComponentReferences.of([]),
        entities: ComponentEntities.of(entities),
      });
    const entityNamed = (name: string, element: string): ComponentEntity =>
      ComponentEntity.of({
        name: EntityName.of(name),
        element: ElementPath.of(element),
        identifier: AttributeName.of("id"),
        references: EntityReferences.of([]),
      });
    const conflicts = Components.of([
      owner("A", "components[0]", [
        entityNamed("Zed", "components[0].entities[0]"),
        entityNamed("Order", "components[0].entities[1]"),
      ]),
      owner("B", "components[1]", [
        entityNamed("Order", "components[1].entities[0]"),
        entityNamed("Solo", "components[1].entities[1]"),
      ]),
      owner("C", "components[2]", [entityNamed("Zed", "components[2].entities[0]")]),
    ]).ownershipConflicts();
    expect(conflicts.map((c) => c.name.asString())).toEqual(["Order", "Zed"]);
    expect(
      conflicts[0]?.owners.map((o) => `${o.component.name().asString()}:${o.entity.element().asString()}`),
    ).toEqual(["A:components[0].entities[1]", "B:components[1].entities[0]"]);
    expect(conflicts[1]?.owners.map((o) => o.component.name().asString())).toEqual(["A", "C"]);
    expect(
      Components.of([
        owner("A", "components[0]", [entityNamed("Solo", "components[0].entities[0]")]),
      ]).ownershipConflicts(),
    ).toEqual([]);
  });
});

describe("refcheck payload collections (first-class operations)", () => {
  test("TargetIdentifiers, FunctionalRequirementReferences, WitnessReferences, Findings, Skips, InputAnchors under add", () => {
    const ids = TargetIdentifiers.of(Array.from(["check:DD-1"], (raw) => TargetIdentifier.of(raw)))
      .add(TargetIdentifier.of("check:DD-0"))
      .add(TargetIdentifier.of("check:DD-1"));
    expect([...ids].map((t) => t.asString())).toEqual(["check:DD-1", "check:DD-0", "check:DD-1"]);
    expect(ids.count()).toBe(3);
    expect(ids.joined(",")).toBe("check:DD-1,check:DD-0,check:DD-1");
    expect(ids.sortedUniqueCanonically().toStrings()).toEqual(["check:DD-0", "check:DD-1"]);

    const refs = FunctionalRequirementReferences.of([]).add(RequirementIdentifier.of("FR-1"));
    expect(refs.toStrings()).toEqual(["FR-1"]);

    const wr = WitnessReference.of({ artifact: "a.md", element: "e" });
    const wrs = WitnessReferences.of([]).add(wr);
    expect([...wrs]).toEqual([wr]);
    expect(wrs.toArray()).toEqual([wr]);

    const f = finding("conflict", ["OB-1"], "x");
    const fs = Findings.of([]).add(f);
    expect([...fs]).toEqual([f]);
    expect(fs.count()).toBe(1);
    expect(fs.isEmpty()).toBe(false);
    expect(Findings.of([]).isEmpty()).toBe(true);

    const sk = Skipped.of({ target: TargetIdentifier.of("check:DD-1"), reason: SkipReason.of("waived") });
    const sks = Skips.of([]).add(sk);
    expect([...sks]).toEqual([sk]);
    expect(sks.count()).toBe(1);

    const ia = InputAnchor.of({ artifact: "b.md", sha256: ContentHash.of("a".repeat(64)) });
    const ias = InputAnchors.of([])
      .add(ia)
      .addAll([InputAnchor.of({ artifact: "a.md", sha256: ContentHash.of("b".repeat(64)) })]);
    expect([...ias].length).toBe(2);
    expect(
      ias
        .sortedByArtifact()
        .toArray()
        .map((i) => i.artifact()),
    ).toEqual(["a.md", "b.md"]);
  });
});

describe("value primitives own their matching logic (tell-don't-ask consolidation)", () => {
  test("ReferenceTarget owns the Entity(.attr) token shape and the loose lowercase mention", () => {
    expect(ReferenceTarget.of("Ticket").entityToken()).toBe("Ticket");
    expect(ReferenceTarget.of("Ticket.status").entityToken()).toBe("Ticket");
    expect(ReferenceTarget.of("the Ticket entity").entityToken()).toBe(null);
    expect(ReferenceTarget.of("see the TICKET flow").looselyMentions(EntityName.of("Ticket"))).toBe(true);
    expect(ReferenceTarget.of("unrelated prose").looselyMentions(EntityName.of("Ticket"))).toBe(false);
  });

  test("AppliesTo owns entity/attribute tokens; the attribute token is null without the dotted form", () => {
    expect(AppliesTo.of("Ticket.status").entityToken()).toBe("Ticket");
    expect(AppliesTo.of("Ticket.status").attributeToken()).toBe("status");
    expect(AppliesTo.of("Ticket").attributeToken()).toBe(null);
    expect(AppliesTo.of("free text target").entityToken()).toBe(null);
    expect(AppliesTo.of("about the ticket").looselyMentions(EntityName.of("Ticket"))).toBe(true);
  });

  test("NumericBound owns the range-inversion comparison", () => {
    expect(NumericBound.of(5).exceeds(NumericBound.of(3))).toBe(true);
    expect(NumericBound.of(3).exceeds(NumericBound.of(3))).toBe(false);
  });

  test("AttributeDefault folds the numeric guard into the bound checks (non-numbers are in range)", () => {
    expect(AttributeDefault.of(1).belowBound(NumericBound.of(2))).toBe(true);
    expect(AttributeDefault.of(3).aboveBound(NumericBound.of(2))).toBe(true);
    expect(AttributeDefault.of("open").belowBound(NumericBound.of(2))).toBe(false);
    expect(AttributeDefault.of("open").aboveBound(NumericBound.of(2))).toBe(false);
  });

  test("AttributeName owns the lifecycle-name vocabulary and the empty-identifier check", () => {
    expect(AttributeName.of("status").isLifecycleName()).toBe(true);
    expect(AttributeName.of("state").isLifecycleName()).toBe(true);
    expect(AttributeName.of("priority").isLifecycleName()).toBe(false);
    expect(AttributeName.parse("").ok).toBe(false);
    expect(AttributeName.of("id").isEmpty()).toBe(false);
  });
});

describe("split-file coverage pins (one-public-type refactor)", () => {
  test("small collections keep of/add/iterator faces", () => {
    const an = AttributeNames.of([AttributeName.of("a")]).add(AttributeName.of("b"));
    expect([...an].map((x) => x.asString())).toEqual(["a", "b"]);
    const si = SourceIdentifiers.of([]).add(SourceIdentifier.of("FR-1"));
    expect([...si].map((x) => x.asString())).toEqual(["FR-1"]);
  });
});

describe("sketch collection pins (one-public-type refactor)", () => {
  test("sketch collections keep iterator and frozen-order faces", () => {
    const de = (name: string) =>
      DomainEntitySketch.of({
        name: EntityName.of(name),
        component: ComponentName.of("Core"),
        attributes: AttributeNames.of([]),
      });
    const des = DomainEntitySketches.of([de("B")])
      .add(de("A"))
      .add(de("a"));
    expect([...des].length).toBe(3);
    // 名前昇順・正規化名の初出のみ（"a" は "A" の正規化重複で落ちる——凍結順）。
    expect(des.sortedDistinctByNormalizedName().map((d) => d.name().asString())).toEqual(["A", "B"]);
    const sm = StateMachineSketch.of({
      spec: MachineSpecification.of("Order"),
      states: StateNames.of([]),
      fenceLine: LineNumber.of(1),
      unsupported: null,
    });
    const sms = StateMachineSketches.of([]).add(sm);
    expect([...sms].length).toBe(1);
    expect(sms.toArray().length).toBe(1);
  });
});

describe("witness ref (a finding's evidence coordinate)", () => {
  test("round-trips its parts, carries an optional raw value, and answers pointsAt", () => {
    const bare = WitnessReference.of({
      artifact: "inception/domain-design/components.md",
      element: "components[0].name",
    });
    const valued = WitnessReference.of({ artifact: "a.md", element: "entities[1]", value: "Order Item" });
    expect(bare.artifact()).toBe("inception/domain-design/components.md");
    expect(bare.element()).toBe("components[0].name");
    expect(bare.value()).toBeUndefined();
    expect(valued.value()).toBe("Order Item");
    expect(valued.pointsAt("a.md", "entities[1]")).toBe(true);
    expect(valued.pointsAt("a.md", "entities[2]")).toBe(false);
    expect(bare.pointsAt("b.md", "components[0].name")).toBe(false);
  });
});

describe("component names order canonically (ruling 1: the id value object owns the order)", () => {
  test("numeric tails compare as numbers", () => {
    expect(ComponentName.of("Svc2").compareTo(ComponentName.of("Svc10"))).toBeLessThan(0);
    expect(ComponentName.of("Svc10").compareTo(ComponentName.of("Svc2"))).toBeGreaterThan(0);
    expect(ComponentName.of("Svc").compareTo(ComponentName.of("Svc"))).toBe(0);
  });
});
