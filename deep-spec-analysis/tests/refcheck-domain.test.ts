// refcheck/domain の単体テスト（DDD 移行 PR2a、issue #15）。
// カタログ順序は golden バイトを決める凍結挙動——順位・タイブレークを固定する。

import { describe, expect, test } from "bun:test";
import { ContentHash, FrRefs, TargetIds } from "../tools/kernel/domain/index.ts";
import { CATALOG_VERSION, type Finding, type Skipped, Findings, InputAnchors, Skips, WitnessRefs } from "../tools/refcheck/domain/index.ts";

function finding(kind: string, targets: string[], detail: string): Finding {
  return { kind, frRefs: FrRefs.of([]), targets: TargetIds.of(targets), witness: { refs: WitnessRefs.of([]) }, detail };
}

describe("catalog-order", () => {
  test("findings sort by the extended kind rank, then joined targets, then detail", () => {
    const sorted = Findings.of([
      finding("cross-check-disagreement", ["SC-1"], "z"),
      finding("structure-invalid", ["check:DD-0"], "b"),
      finding("structure-invalid", ["check:DD-0"], "a"),
      finding("reference-broken", ["component:A"], "x"),
      finding("conflict", ["OB-9"], "y"),
    ]).sortedCanonically().toArray();
    expect(sorted.map((f) => `${f.kind}/${f.detail}`)).toEqual([
      "conflict/y",
      "structure-invalid/a",
      "structure-invalid/b",
      "reference-broken/x",
      "cross-check-disagreement/z",
    ]);
  });

  test("an unknown kind ranks after every catalogued kind (fallback 99)", () => {
    const sorted = Findings.of([finding("mystery-kind", ["X-1"], "m"), finding("cross-check-disagreement", ["SC-1"], "c")]).sortedCanonically().toArray();
    expect(sorted[0]?.kind).toBe("cross-check-disagreement");
  });

  test("a prototype-inherited name as kind falls back like any unknown kind (no NaN ranks)", () => {
    const sorted = Findings.of([
      finding("toString", ["X-1"], "t"),
      finding("constructor", ["X-2"], "c"),
      finding("conflict", ["OB-1"], "k"),
    ]).sortedCanonically().toArray();
    expect(sorted[0]?.kind).toBe("conflict");
    // 両者とも fallback 99 で同順位 → targets 文字列比較で "X-1" が先。
    expect(sorted.slice(1).map((f) => f.kind)).toEqual(["toString", "constructor"]);
  });

  test("skips sort by id order on target, then by reason", () => {
    const skips: Skipped[] = [
      { target: "check:FD-E10", reason: "b" },
      { target: "check:FD-E2", reason: "a" },
      { target: "check:FD-E2", reason: "A" },
    ];
    expect(Skips.of(skips).sortedCanonically().toArray().map((s) => `${s.target}/${s.reason}`)).toEqual([
      "check:FD-E2/A",
      "check:FD-E2/a",
      "check:FD-E10/b",
    ]);
  });

  test("the catalog version pins the contract line refcheck documents declare", () => {
    expect(CATALOG_VERSION).toBe("1.0.0");
  });
});

// functional-design 語彙 DP — parse（strict 境界）と reconstitute（凍結再水和）
// の二面性、および照合・描画の解釈語彙の分岐網羅。
import {
  AllowedValue,
  AppliesTo,
  AttributeDefault,
  AttributeName,
  BusinessRuleId,
  CardinalityNotation,
  ComponentName,
  ElementPath,
  EntityName,
  MachineSpec,
  NumericBound,
  ReferenceTarget,
  RuleCategory,
  SourceId,
  StateName,
  TypeName,
} from "../tools/refcheck/domain/index.ts";

describe("functional-design vocabulary domain primitives", () => {
  test("token DPs: parse rejects the empty string, reconstitute is verbatim, equals is by value", () => {
    const cases: { parse: (raw: string) => { ok: boolean }; reconstitute: (raw: string) => { asString(): string } }[] = [
      EntityName, AttributeName, ElementPath, TypeName, AllowedValue,
      CardinalityNotation, RuleCategory, AppliesTo, SourceId, MachineSpec, StateName, ComponentName, ReferenceTarget,
    ];
    for (const dp of cases) {
      const bad = dp.parse("");
      expect(bad.ok).toBe(false);
      const good = dp.parse("Order");
      expect(good.ok).toBe(true);
      expect(dp.reconstitute("x").asString()).toBe("x");
    }
    expect(EntityName.reconstitute("A").equals(EntityName.reconstitute("A"))).toBe(true);
    expect(AttributeName.reconstitute("a").equals(AttributeName.reconstitute("b"))).toBe(false);
    expect(ElementPath.reconstitute("e[0]").equals(ElementPath.reconstitute("e[0]"))).toBe(true);
    expect(TypeName.reconstitute("t").equals(TypeName.reconstitute("t"))).toBe(true);
    expect(AllowedValue.reconstitute("v").equals(AllowedValue.reconstitute("w"))).toBe(false);
    expect(CardinalityNotation.reconstitute("1:1").equals(CardinalityNotation.reconstitute("1:1"))).toBe(true);
    expect(RuleCategory.reconstitute("c").equals(RuleCategory.reconstitute("c"))).toBe(true);
    expect(AppliesTo.reconstitute("A").equals(AppliesTo.reconstitute("B"))).toBe(false);
    expect(SourceId.reconstitute("FR-1").equals(SourceId.reconstitute("FR-1"))).toBe(true);
    expect(StateName.reconstitute("s").equals(StateName.reconstitute("s"))).toBe(true);
    expect(ComponentName.reconstitute("C").equals(ComponentName.reconstitute("D"))).toBe(false);
    expect(ReferenceTarget.reconstitute("R").equals(ReferenceTarget.reconstitute("R"))).toBe(true);
    expect(MachineSpec.reconstitute("m").equals(MachineSpec.reconstitute("m"))).toBe(true);
  });

  test("interpretation vocabulary: normalization, shape, spec decomposition, defaults, bounds", () => {
    expect(EntityName.reconstitute("Order Item").normalized()).toBe(StateName.reconstitute("order_item").normalized());
    expect(TypeName.reconstitute("Decimal").normalized()).toBe("decimal");
    expect(CardinalityNotation.reconstitute(" 1 : n ").normalizedToken()).toBe("1:N");
    expect(BusinessRuleId.reconstitute("BR1.2").matchesShape()).toBe(true);
    expect(BusinessRuleId.reconstitute("BRX").matchesShape()).toBe(false);
    expect(BusinessRuleId.parse("BR1.2").ok).toBe(true);
    expect(BusinessRuleId.parse("nope").ok).toBe(false);
    expect(BusinessRuleId.reconstitute("BR1.2").equals(BusinessRuleId.reconstitute("BR1.2"))).toBe(true);
    expect(BusinessRuleId.reconstitute("BR1.2").asString()).toBe("BR1.2");
    expect(RuleCategory.reconstitute("Validation").normalized()).toBe("validation");
    expect(AttributeName.reconstitute("Status").normalized()).toBe("status");
    expect(AllowedValue.reconstitute("Open").normalized()).toBe("open");

    const spec = MachineSpec.reconstitute("Order.status");
    expect(spec.entityToken()).toBe("Order");
    expect(spec.attributeToken()).toBe("status");
    expect(MachineSpec.reconstitute("Order").attributeToken()).toBe(undefined);
    expect(spec.asString()).toBe("Order.status");

    const numDef = AttributeDefault.reconstitute(5);
    expect(numDef.isNumber()).toBe(true);
    expect(numDef.isString()).toBe(false);
    expect(numDef.asNumber()).toBe(5);
    expect(numDef.render()).toBe("5");
    const strDef = AttributeDefault.reconstitute("open");
    expect(strDef.isString()).toBe(true);
    expect(strDef.asString()).toBe("open");
    expect(strDef.render()).toBe("open");

    expect(NumericBound.parse(3).ok).toBe(true);
    expect(NumericBound.parse(Number.NaN).ok).toBe(false);
    expect(NumericBound.reconstitute(3).asNumber()).toBe(3);
    expect(NumericBound.reconstitute(3).equals(NumericBound.reconstitute(3))).toBe(true);
    expect(ReferenceTarget.reconstitute("Order.id").asString()).toBe("Order.id");
    expect(ElementPath.reconstitute("entities[0]").asString()).toBe("entities[0]");
    expect(SourceId.reconstitute("FR-1").asString()).toBe("FR-1");
    expect(AppliesTo.reconstitute("Order").asString()).toBe("Order");
    expect(ComponentName.reconstitute("Core").asString()).toBe("Core");
  });
});

// ファーストクラスコレクション — 不変の追加・巡回・境界脱出口・集合知識の分岐網羅。
import {
  AllowedValues,
  AttrDecl,
  AttrDecls,
  AttributeNames,
  BlockIndex,
  CheckFamilies,
  CheckFamily,
  Component,
  ComponentEntities,
  ComponentEntity,
  ComponentRef,
  ComponentRefs,
  Components,
  ComponentShapeErrors,
  ContractId,
  ContractParty,
  ContractRows,
  EntityReferences,
  LineNumber,
  SpecBlockAssessments,
  UnitDecls,
  UnitName,
  UnitNames,
  DomainEntitySketch,
  DomainEntitySketches,
  EntityDecl,
  EntityDecls,
  RelDecl,
  RelDecls,
  RuleDecl,
  RuleDecls,
  ShapeErrors,
  SiblingUnitIndex,
  SourceIds,
  StateMachineSketch,
  StateMachineSketches,
  StateNames,
} from "../tools/refcheck/domain/index.ts";

describe("first-class collections", () => {
  const attr = (name: string, allowed: string[] | null = null): AttrDecl =>
    AttrDecl.reconstitute({
      name: AttributeName.reconstitute(name),
      element: ElementPath.reconstitute(`e.${name}`),
      type: null,
      uniqueIsTrue: false,
      references: null,
      allowed: allowed === null ? null : AllowedValues.of(allowed.map((v) => AllowedValue.reconstitute(v))),
      def: null,
      minDeclared: false,
      maxDeclared: false,
      min: null,
      max: null,
    });
  const entity = (name: string, attrs: AttrDecl[] = []): EntityDecl =>
    EntityDecl.reconstitute({
      name: EntityName.reconstitute(name),
      element: ElementPath.reconstitute(`entities.${name}`),
      attrs: AttrDecls.of(attrs),
      rels: RelDecls.of([]),
    });

  test("add is immutable append across every collection", () => {
    const names = AttributeNames.of([]);
    expect(names.count()).toBe(0);
    expect(names.add(AttributeName.reconstitute("qty")).count()).toBe(1);
    expect(names.count()).toBe(0);

    expect([...AllowedValues.of([]).add(AllowedValue.reconstitute("open"))].length).toBe(1);
    expect([...StateNames.of([]).add(StateName.reconstitute("open"))].length).toBe(1);
    expect(SourceIds.of([]).add(SourceId.reconstitute("FR-1")).toArray().length).toBe(1);
    expect(AttrDecls.of([]).add(attr("a")).toArray().length).toBe(1);
    expect(EntityDecls.of([]).add(entity("Order")).toArray().length).toBe(1);
    expect([...RelDecls.of([]).add(RelDecl.reconstitute({ element: ElementPath.reconstitute("r[0]"), from: null, to: null, cardinality: null, hasDirection: false }))].length).toBe(1);
    expect(RuleDecls.of([]).add(RuleDecl.reconstitute({ id: null, element: ElementPath.reconstitute("rules[0]"), category: null, appliesTo: null, sourceIds: SourceIds.of([]), missing: [] })).toArray().length).toBe(1);
    expect(ShapeErrors.of([]).add({ element: ElementPath.reconstitute("entities"), detail: "x" }).toArray().length).toBe(1);
    const sketch = StateMachineSketch.reconstitute({ spec: MachineSpec.reconstitute("Order"), states: StateNames.of([]), fenceLine: LineNumber.reconstitute(1), unsupported: null });
    expect(StateMachineSketches.of([]).add(sketch).isEmpty()).toBe(false);
    const de = DomainEntitySketch.reconstitute({ name: EntityName.reconstitute("Order"), component: ComponentName.reconstitute("Core"), attributes: AttributeNames.of([]) });
    expect(DomainEntitySketches.of([]).add(de).toArray().length).toBe(1);
  });

  test("collection-owned set knowledge: names, duplicates, membership, index lookups", () => {
    const attrs = AttrDecls.of([attr("status", ["open"]), attr("qty"), attr("status")]);
    expect(attrs.names().map((n) => n.asString())).toEqual(["status", "qty", "status"]);
    expect(attrs.duplicatesByName().map((a) => a.name().asString())).toEqual(["status"]);
    expect(attrs.named("qty")?.name().asString()).toBe("qty");
    expect(attrs.lifecycleAttr()?.name().asString()).toBe("status");

    const decls = EntityDecls.of([entity("Order"), entity("Order")]);
    expect(decls.duplicatesByName().length).toBe(1);
    expect(decls.containsNamed("Order")).toBe(true);
    expect(decls.containsNamed("Ghost")).toBe(false);

    const rels = RelDecls.of([]).concat(RelDecls.of([RelDecl.reconstitute({ element: ElementPath.reconstitute("r[0]"), from: null, to: null, cardinality: null, hasDirection: true })]));
    expect(rels.toArray().length).toBe(1);

    const index = SiblingUnitIndex.of(new Map([["u1", new Map([["order", { name: EntityName.reconstitute("Order"), attrs: AttributeNames.of([AttributeName.reconstitute("qty")]) }]])]]));
    expect(index.hasAnyUnit()).toBe(true);
    expect(index.definersOf("order")).toEqual(["u1"]);
    expect(index.entityDeclaredIn("u1", "order")?.name.asString()).toBe("Order");
    expect(index.entityDeclaredIn("u9", "order")).toBe(undefined);
    expect(SiblingUnitIndex.of(new Map()).hasAnyUnit()).toBe(false);

    const sketches = DomainEntitySketches.of([
      DomainEntitySketch.reconstitute({ name: EntityName.reconstitute("Order"), component: ComponentName.reconstitute("Core"), attributes: AttributeNames.of([]) }),
      DomainEntitySketch.reconstitute({ name: EntityName.reconstitute("order"), component: ComponentName.reconstitute("Core"), attributes: AttributeNames.of([]) }),
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
    expect(dd.value.equals(CheckFamily.reconstitute("DD-1"))).toBe(true);
    expect(dd.value.prefixedDetail("boom")).toBe("DD-1: boom");
    expect(dd.value.asCheckTarget()).toBe("check:DD-1");
  });

  test("CheckFamilies derives checked targets in declaration order under add", () => {
    const fams = CheckFamilies.reconstitute(["A-1"]).add(CheckFamily.reconstitute("A-2")).add(CheckFamily.reconstitute("A-3"));
    expect([...fams].map((f) => f.asString())).toEqual(["A-1", "A-2", "A-3"]);
    expect(fams.toArray().length).toBe(3);
    expect(fams.checkedTargetsExcluding(new Set(["A-2"]), new Set(["A-3"]))).toEqual(["check:A-1"]);
  });

  test("UnitName and UnitNames carry declaration knowledge", () => {
    expect(UnitName.parse("").ok).toBe(false);
    const u = UnitName.parse("cart");
    if (!u.ok) throw new Error("unreachable");
    expect(u.value.equals(UnitName.reconstitute("cart"))).toBe(true);
    const names = UnitNames.reconstitute(["b"]).add(UnitName.reconstitute("a"));
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
    expect(ln.value.equals(LineNumber.reconstitute(7))).toBe(true);
    const bi = BlockIndex.parse(2);
    if (!bi.ok) throw new Error("unreachable");
    expect(bi.value.equals(BlockIndex.reconstitute(2))).toBe(true);
  });

  test("ContractId, ContractParty and ContractRows own the CD vocabulary", () => {
    expect(ContractId.parse("").ok).toBe(false);
    const cid = ContractId.parse("3");
    if (!cid.ok) throw new Error("unreachable");
    expect(cid.value.equals(ContractId.reconstitute("3"))).toBe(true);
    expect(ContractParty.reconstitute("").isBlank()).toBe(true);
    expect(ContractParty.reconstitute("External: billing").declaresExternal()).toBe(true);
    expect(ContractParty.reconstitute("cart").declaresExternal()).toBe(false);
    expect(ContractParty.reconstitute("cart").equals(ContractParty.reconstitute("cart"))).toBe(true);
    const row = {
      id: ContractId.reconstitute("1"),
      provider: ContractParty.reconstitute("cart"),
      consumer: ContractParty.reconstitute("billing"),
      owner: ContractParty.reconstitute("cart"),
      line: LineNumber.reconstitute(3),
    };
    const rows = ContractRows.of([]).add(row);
    expect([...rows]).toEqual([row]);
    expect(rows.toArray()).toEqual([row]);
    expect(rows.coversEdge("cart", "billing")).toBe(true);
    expect(rows.coversEdge("billing", "cart")).toBe(true);
    expect(rows.coversEdge("cart", "ghost")).toBe(false);
  });

  test("UnitDecls and SpecBlockAssessments hold declaration and assessment knowledge", () => {
    const decl = { name: UnitName.reconstitute("b"), dependsOn: UnitNames.reconstitute(["a"]) };
    const decls = UnitDecls.of([]).add(decl).add({ name: UnitName.reconstitute("a"), dependsOn: UnitNames.reconstitute([]) });
    expect(decls.declares("b")).toBe(true);
    expect(decls.declares("z")).toBe(false);
    expect([...decls.sortedByName()].map((d) => d.name.asString())).toEqual(["a", "b"]);
    expect(decls.names().declares("a")).toBe(true);
    expect(decls.toArray().length).toBe(2);
    const block = { index: BlockIndex.reconstitute(1), line: LineNumber.reconstitute(1), issue: null };
    const blocks = SpecBlockAssessments.of([]).add(block);
    expect([...blocks]).toEqual([block]);
    expect(blocks.toArray()).toEqual([block]);
  });

  test("component collections resolve names, symmetry and cycles as their own knowledge", () => {
    const el = ElementPath.reconstitute("components[0]");
    const aName = ComponentName.reconstitute("A");
    const bName = ComponentName.reconstitute("B");
    const refAtoB = ComponentRef.reconstitute({ component: bName, element: el });
    const refBtoA = ComponentRef.reconstitute({ component: aName, element: el });
    const entity = ComponentEntity.reconstitute({
      name: EntityName.reconstitute("Order"),
      element: el,
      identifier: AttributeName.reconstitute("id"),
      references: EntityReferences.of([]).add({ entity: EntityName.reconstitute("Line"), ownedBy: bName, element: el }),
    });
    const a = Component.reconstitute({ name: aName, element: el, dependsOn: ComponentRefs.of([refAtoB]), dependents: ComponentRefs.of([refBtoA]), entities: ComponentEntities.of([entity]) });
    const b = Component.reconstitute({ name: bName, element: el, dependsOn: ComponentRefs.of([refBtoA]), dependents: ComponentRefs.of([]), entities: ComponentEntities.of([]) });
    const comps = Components.of([]).add(a).add(b);
    expect(comps.count()).toBe(2);
    expect([...comps].length).toBe(2);
    expect(comps.declares(aName)).toBe(true);
    expect(comps.declares(ComponentName.reconstitute("Z"))).toBe(false);
    expect(comps.byName(bName)).toBe(b);
    expect(comps.byName(ComponentName.reconstitute("Z"))).toBe(null);
    expect(a.name().asString()).toBe("A");
    expect(a.element().asString()).toBe("components[0]");
    expect(a.dependsOn().listsComponent(bName)).toBe(true);
    expect(a.dependsOn().toArray().length).toBe(1);
    expect([...a.dependsOn()].length).toBe(1);
    expect(a.dependsOn().add(refBtoA).toArray().length).toBe(2);
    expect(a.dependents().toArray().length).toBe(1);
    expect(a.entities().declaresEntity(EntityName.reconstitute("Order"))).toBe(true);
    expect(a.entities().declaresEntity(EntityName.reconstitute("Ghost"))).toBe(false);
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
    const aDup = Component.reconstitute({ name: aName, element: ElementPath.reconstitute("components[9]"), dependsOn: ComponentRefs.of([]), dependents: ComponentRefs.of([]), entities: ComponentEntities.of([]) });
    const withDup = comps.add(aDup);
    expect(withDup.byName(aName)?.element().asString()).toBe("components[9]");
    const errs = ComponentShapeErrors.of([]).add({ element: el, detail: "x" });
    expect(errs.count()).toBe(1);
    expect([...errs].length).toBe(1);
    expect(errs.toArray()[0]?.detail).toBe("x");
  });

  test("components own their shape checks: PascalCase, duplicates, self-dependency, ownership (wave 6)", () => {
    const el = ElementPath.reconstitute("components[0]");
    const bare = (name: string, element: string): Component =>
      Component.reconstitute({
        name: ComponentName.reconstitute(name),
        element: ElementPath.reconstitute(element),
        dependsOn: ComponentRefs.of([]),
        dependents: ComponentRefs.of([]),
        entities: ComponentEntities.of([]),
      });

    // DD-1: PascalCase は宣言自身の判定。
    expect(bare("Order", "components[0]").nameIsPascalCase()).toBe(true);
    expect(bare("order", "components[0]").nameIsPascalCase()).toBe(false);

    // DD-1: 重複は直前の宣言との対（宣言順——3 度目は 2 度目と対になる）。
    const dups = Components.of([bare("A", "components[0]"), bare("B", "components[1]"), bare("A", "components[2]"), bare("A", "components[3]")]);
    expect(dups.duplicateNamePairs().map((p) => `${p.prior.element().asString()}→${p.current.element().asString()}`)).toEqual([
      "components[0]→components[2]",
      "components[2]→components[3]",
    ]);
    expect(Components.of([bare("A", "components[0]"), bare("B", "components[1]")]).duplicateNamePairs()).toEqual([]);

    // DD-3: 自己参照は depends_on → dependents の走査順で届く。
    const selfName = ComponentName.reconstitute("Self");
    const self = Component.reconstitute({
      name: selfName,
      element: el,
      dependsOn: ComponentRefs.of([ComponentRef.reconstitute({ component: selfName, element: ElementPath.reconstitute("components[0].depends_on[0].component") })]),
      dependents: ComponentRefs.of([
        ComponentRef.reconstitute({ component: ComponentName.reconstitute("Other"), element: el }),
        ComponentRef.reconstitute({ component: selfName, element: ElementPath.reconstitute("components[0].dependents[1].component") }),
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
      ComponentEntity.reconstitute({
        name: EntityName.reconstitute("Order"),
        element: el,
        identifier: identifier === null ? null : AttributeName.reconstitute(identifier),
        references: EntityReferences.of([]),
      });
    expect(entityOf("id").hasIdentifier()).toBe(true);
    expect(entityOf(null).hasIdentifier()).toBe(false);
    expect(entityOf("").hasIdentifier()).toBe(false);

    // DD-5: 所有競合はエンティティ名昇順、所有側は宣言順——単一所有は届かない。
    const owner = (comp: string, element: string, entities: ComponentEntity[]): Component =>
      Component.reconstitute({
        name: ComponentName.reconstitute(comp),
        element: ElementPath.reconstitute(element),
        dependsOn: ComponentRefs.of([]),
        dependents: ComponentRefs.of([]),
        entities: ComponentEntities.of(entities),
      });
    const entityNamed = (name: string, element: string): ComponentEntity =>
      ComponentEntity.reconstitute({
        name: EntityName.reconstitute(name),
        element: ElementPath.reconstitute(element),
        identifier: AttributeName.reconstitute("id"),
        references: EntityReferences.of([]),
      });
    const conflicts = Components.of([
      owner("A", "components[0]", [entityNamed("Zed", "components[0].entities[0]"), entityNamed("Order", "components[0].entities[1]")]),
      owner("B", "components[1]", [entityNamed("Order", "components[1].entities[0]"), entityNamed("Solo", "components[1].entities[1]")]),
      owner("C", "components[2]", [entityNamed("Zed", "components[2].entities[0]")]),
    ]).ownershipConflicts();
    expect(conflicts.map((c) => c.name.asString())).toEqual(["Order", "Zed"]);
    expect(conflicts[0]?.owners.map((o) => `${o.component.name().asString()}:${o.entity.element().asString()}`)).toEqual([
      "A:components[0].entities[1]",
      "B:components[1].entities[0]",
    ]);
    expect(conflicts[1]?.owners.map((o) => o.component.name().asString())).toEqual(["A", "C"]);
    expect(Components.of([owner("A", "components[0]", [entityNamed("Solo", "components[0].entities[0]")])]).ownershipConflicts()).toEqual([]);
  });
});

describe("refcheck payload collections (first-class operations)", () => {
  test("TargetIds, FrRefs, WitnessRefs, Findings, Skips, InputAnchors under add", () => {
    const ids = TargetIds.of(["check:DD-1"]).add("check:DD-0").add("check:DD-1");
    expect([...ids]).toEqual(["check:DD-1", "check:DD-0", "check:DD-1"]);
    expect(ids.count()).toBe(3);
    expect(ids.joined(",")).toBe("check:DD-1,check:DD-0,check:DD-1");
    expect(ids.sortedUniqueCanonically().toArray()).toEqual(["check:DD-0", "check:DD-1"]);

    const refs = FrRefs.of([]).add("FR-1");
    expect([...refs]).toEqual(["FR-1"]);

    const wr = { artifact: "a.md", element: "e" };
    const wrs = WitnessRefs.of([]).add(wr);
    expect([...wrs]).toEqual([wr]);
    expect(wrs.toArray()).toEqual([wr]);

    const f = finding("conflict", ["OB-1"], "x");
    const fs = Findings.of([]).add(f);
    expect([...fs]).toEqual([f]);
    expect(fs.count()).toBe(1);
    expect(fs.isEmpty()).toBe(false);
    expect(Findings.of([]).isEmpty()).toBe(true);

    const sk = { target: "check:DD-1", reason: "waived" };
    const sks = Skips.of([]).add(sk);
    expect([...sks]).toEqual([sk]);
    expect(sks.count()).toBe(1);

    const ia = { artifact: "b.md", sha256: ContentHash.reconstitute("a".repeat(64)) };
    const ias = InputAnchors.of([]).add(ia).addAll([{ artifact: "a.md", sha256: ContentHash.reconstitute("b".repeat(64)) }]);
    expect([...ias].length).toBe(2);
    expect(ias.sortedByArtifact().toArray().map((i) => i.artifact)).toEqual(["a.md", "b.md"]);
  });
});

describe("value primitives own their matching logic (tell-don't-ask consolidation)", () => {
  test("ReferenceTarget owns the Entity(.attr) token shape and the loose lowercase mention", () => {
    expect(ReferenceTarget.reconstitute("Ticket").entityToken()).toBe("Ticket");
    expect(ReferenceTarget.reconstitute("Ticket.status").entityToken()).toBe("Ticket");
    expect(ReferenceTarget.reconstitute("the Ticket entity").entityToken()).toBe(null);
    expect(ReferenceTarget.reconstitute("see the TICKET flow").looselyMentions(EntityName.reconstitute("Ticket"))).toBe(true);
    expect(ReferenceTarget.reconstitute("unrelated prose").looselyMentions(EntityName.reconstitute("Ticket"))).toBe(false);
  });

  test("AppliesTo owns entity/attribute tokens; the attribute token is null without the dotted form", () => {
    expect(AppliesTo.reconstitute("Ticket.status").entityToken()).toBe("Ticket");
    expect(AppliesTo.reconstitute("Ticket.status").attributeToken()).toBe("status");
    expect(AppliesTo.reconstitute("Ticket").attributeToken()).toBe(null);
    expect(AppliesTo.reconstitute("free text target").entityToken()).toBe(null);
    expect(AppliesTo.reconstitute("about the ticket").looselyMentions(EntityName.reconstitute("Ticket"))).toBe(true);
  });

  test("NumericBound owns the range-inversion comparison", () => {
    expect(NumericBound.reconstitute(5).exceeds(NumericBound.reconstitute(3))).toBe(true);
    expect(NumericBound.reconstitute(3).exceeds(NumericBound.reconstitute(3))).toBe(false);
  });

  test("AttributeDefault folds the numeric guard into the bound checks (non-numbers are in range)", () => {
    expect(AttributeDefault.reconstitute(1).belowBound(NumericBound.reconstitute(2))).toBe(true);
    expect(AttributeDefault.reconstitute(3).aboveBound(NumericBound.reconstitute(2))).toBe(true);
    expect(AttributeDefault.reconstitute("open").belowBound(NumericBound.reconstitute(2))).toBe(false);
    expect(AttributeDefault.reconstitute("open").aboveBound(NumericBound.reconstitute(2))).toBe(false);
  });

  test("AttributeName owns the lifecycle-name vocabulary and the empty-identifier check", () => {
    expect(AttributeName.reconstitute("status").isLifecycleName()).toBe(true);
    expect(AttributeName.reconstitute("state").isLifecycleName()).toBe(true);
    expect(AttributeName.reconstitute("priority").isLifecycleName()).toBe(false);
    expect(AttributeName.reconstitute("").isEmpty()).toBe(true);
    expect(AttributeName.reconstitute("id").isEmpty()).toBe(false);
  });
});

describe("split-file coverage pins (one-public-type refactor)", () => {
  test("small collections keep of/add/iterator faces", () => {
    const an = AttributeNames.of([AttributeName.reconstitute("a")]).add(AttributeName.reconstitute("b"));
    expect([...an].map((x) => x.asString())).toEqual(["a", "b"]);
    const si = SourceIds.of([]).add(SourceId.reconstitute("FR-1"));
    expect([...si].map((x) => x.asString())).toEqual(["FR-1"]);
  });
});

describe("sketch collection pins (one-public-type refactor)", () => {
  test("sketch collections keep iterator and frozen-order faces", () => {
    const de = (name: string) =>
      DomainEntitySketch.reconstitute({
        name: EntityName.reconstitute(name),
        component: ComponentName.reconstitute("Core"),
        attributes: AttributeNames.of([]),
      });
    const des = DomainEntitySketches.of([de("B")]).add(de("A")).add(de("a"));
    expect([...des].length).toBe(3);
    // 名前昇順・正規化名の初出のみ（"a" は "A" の正規化重複で落ちる——凍結順）。
    expect(des.sortedDistinctByNormalizedName().map((d) => d.name().asString())).toEqual(["A", "B"]);
    const sm = StateMachineSketch.reconstitute({
      spec: MachineSpec.reconstitute("Order"),
      states: StateNames.of([]),
      fenceLine: LineNumber.reconstitute(1),
      unsupported: null,
    });
    const sms = StateMachineSketches.of([]).add(sm);
    expect([...sms].length).toBe(1);
    expect(sms.toArray().length).toBe(1);
  });
});
