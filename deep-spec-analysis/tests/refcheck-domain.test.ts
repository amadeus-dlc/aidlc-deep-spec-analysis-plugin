// refcheck/domain の単体テスト（DDD 移行 PR2a、issue #15）。
// カタログ順序は golden バイトを決める凍結挙動——順位・タイブレークを固定する。

import { describe, expect, test } from "bun:test";
import { CATALOG_VERSION, type Finding, type Skipped, sortFindings, sortSkipped } from "../tools/refcheck/domain/index.ts";

function finding(kind: string, targets: string[], detail: string): Finding {
  return { kind, frRefs: [], targets, witness: { refs: [] }, detail };
}

describe("catalog-order", () => {
  test("findings sort by the extended kind rank, then joined targets, then detail", () => {
    const sorted = sortFindings([
      finding("cross-check-disagreement", ["SC-1"], "z"),
      finding("structure-invalid", ["check:DD-0"], "b"),
      finding("structure-invalid", ["check:DD-0"], "a"),
      finding("reference-broken", ["component:A"], "x"),
      finding("conflict", ["OB-9"], "y"),
    ]);
    expect(sorted.map((f) => `${f.kind}/${f.detail}`)).toEqual([
      "conflict/y",
      "structure-invalid/a",
      "structure-invalid/b",
      "reference-broken/x",
      "cross-check-disagreement/z",
    ]);
  });

  test("an unknown kind ranks after every catalogued kind (fallback 99)", () => {
    const sorted = sortFindings([finding("mystery-kind", ["X-1"], "m"), finding("cross-check-disagreement", ["SC-1"], "c")]);
    expect(sorted[0]?.kind).toBe("cross-check-disagreement");
  });

  test("a prototype-inherited name as kind falls back like any unknown kind (no NaN ranks)", () => {
    const sorted = sortFindings([
      finding("toString", ["X-1"], "t"),
      finding("constructor", ["X-2"], "c"),
      finding("conflict", ["OB-1"], "k"),
    ]);
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
    expect(sortSkipped(skips).map((s) => `${s.target}/${s.reason}`)).toEqual([
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
    const cases: { parse: (raw: string) => { ok: boolean }; reconstitute: (raw: string) => { value(): string } }[] = [
      EntityName, AttributeName, ElementPath, TypeName, AllowedValue,
      CardinalityNotation, RuleCategory, AppliesTo, SourceId, MachineSpec, StateName, ComponentName, ReferenceTarget,
    ];
    for (const dp of cases) {
      const bad = dp.parse("");
      expect(bad.ok).toBe(false);
      const good = dp.parse("Order");
      expect(good.ok).toBe(true);
      expect(dp.reconstitute("x").value()).toBe("x");
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
    expect(BusinessRuleId.reconstitute("BR1.2").value()).toBe("BR1.2");
    expect(RuleCategory.reconstitute("Validation").normalized()).toBe("validation");
    expect(AttributeName.reconstitute("Status").normalized()).toBe("status");
    expect(AllowedValue.reconstitute("Open").normalized()).toBe("open");

    const spec = MachineSpec.reconstitute("Order.status");
    expect(spec.entityToken()).toBe("Order");
    expect(spec.attributeToken()).toBe("status");
    expect(MachineSpec.reconstitute("Order").attributeToken()).toBe(undefined);
    expect(spec.value()).toBe("Order.status");

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
    expect(NumericBound.reconstitute(3).value()).toBe(3);
    expect(NumericBound.reconstitute(3).equals(NumericBound.reconstitute(3))).toBe(true);
    expect(ReferenceTarget.reconstitute("Order.id").value()).toBe("Order.id");
    expect(ElementPath.reconstitute("entities[0]").value()).toBe("entities[0]");
    expect(SourceId.reconstitute("FR-1").value()).toBe("FR-1");
    expect(AppliesTo.reconstitute("Order").value()).toBe("Order");
    expect(ComponentName.reconstitute("Core").value()).toBe("Core");
  });
});

// ファーストクラスコレクション — 不変の追加・巡回・境界脱出口・集合知識の分岐網羅。
import {
  AllowedValues,
  AttrDecl,
  AttrDecls,
  AttributeNames,
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
    const sketch = StateMachineSketch.reconstitute({ spec: MachineSpec.reconstitute("Order"), states: StateNames.of([]), fenceLine: 1, unsupported: null });
    expect(StateMachineSketches.of([]).add(sketch).isEmpty()).toBe(false);
    const de = DomainEntitySketch.reconstitute({ name: EntityName.reconstitute("Order"), component: ComponentName.reconstitute("Core"), attributes: AttributeNames.of([]) });
    expect(DomainEntitySketches.of([]).add(de).toArray().length).toBe(1);
  });

  test("collection-owned set knowledge: names, duplicates, membership, index lookups", () => {
    const attrs = AttrDecls.of([attr("status", ["open"]), attr("qty"), attr("status")]);
    expect(attrs.names().map((n) => n.value())).toEqual(["status", "qty", "status"]);
    expect(attrs.duplicatesByName().map((a) => a.name().value())).toEqual(["status"]);
    expect(attrs.named("qty")?.name().value()).toBe("qty");
    expect(attrs.lifecycleAttr()?.name().value()).toBe("status");

    const decls = EntityDecls.of([entity("Order"), entity("Order")]);
    expect(decls.duplicatesByName().length).toBe(1);
    expect(decls.containsNamed("Order")).toBe(true);
    expect(decls.containsNamed("Ghost")).toBe(false);

    const rels = RelDecls.of([]).concat(RelDecls.of([RelDecl.reconstitute({ element: ElementPath.reconstitute("r[0]"), from: null, to: null, cardinality: null, hasDirection: true })]));
    expect(rels.toArray().length).toBe(1);

    const index = SiblingUnitIndex.of(new Map([["u1", new Map([["order", { name: EntityName.reconstitute("Order"), attrs: AttributeNames.of([AttributeName.reconstitute("qty")]) }]])]]));
    expect(index.hasAnyUnit()).toBe(true);
    expect(index.definersOf("order")).toEqual(["u1"]);
    expect(index.entityDeclaredIn("u1", "order")?.name.value()).toBe("Order");
    expect(index.entityDeclaredIn("u9", "order")).toBe(undefined);
    expect(SiblingUnitIndex.of(new Map()).hasAnyUnit()).toBe(false);

    const sketches = DomainEntitySketches.of([
      DomainEntitySketch.reconstitute({ name: EntityName.reconstitute("Order"), component: ComponentName.reconstitute("Core"), attributes: AttributeNames.of([]) }),
      DomainEntitySketch.reconstitute({ name: EntityName.reconstitute("order"), component: ComponentName.reconstitute("Core"), attributes: AttributeNames.of([]) }),
    ]);
    expect(sketches.sortedDistinctByNormalizedName().length).toBe(1);
  });
});
