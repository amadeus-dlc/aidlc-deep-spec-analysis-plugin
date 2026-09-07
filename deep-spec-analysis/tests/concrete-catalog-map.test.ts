import { expect, test } from "bun:test";
import {
  BusinessRuleReference,
  BusinessRuleReferenceIndex,
  BusinessRuleReferences,
  DesignAttributeCatalog,
  DesignAttributeCatalogEntry,
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignBackgroundAssumptions,
  DesignEntityDeclaration,
  DesignEntityDeclarations,
  DesignEntityName,
  DesignEventRule,
  DesignEventRuleCatalog,
  DesignMachines,
  DesignObligation,
  DesignObligationIdentifier,
  DesignObligationOrigin,
  DesignObligations,
  DesignScenarios,
  DesignUnit,
} from "@deep-spec-analysis/design-domain";
import {
  AttributeKind,
  FunctionalRequirementReferences,
  KeyedIndex,
  ObligationNature,
  TargetIdentifier,
  TriggerName,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import {
  AttributeDeclaration,
  AttributeDeclarations,
  AttributeName,
  ElementPath,
  EntityDeclaration,
  EntityDeclarations,
  EntityName,
  RelationshipDeclarations,
  SiblingUnitIndex,
  SiblingUnitIndexEntry,
} from "@deep-spec-analysis/refcheck-domain";
import {
  IntermediateRepresentationAttributeCatalog,
  IntermediateRepresentationAttributeDeclaration,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationAttributeEntry,
  IntermediateRepresentationAttributeName,
  IntermediateRepresentationEntityDeclaration,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationEntityName,
} from "@deep-spec-analysis/requirements-domain";

const designAttribute = (name: string) =>
  DesignAttributeDeclaration.of({ name: DesignAttributeName.of(name), kind: AttributeKind.of("int") });
const irAttribute = (name: string) =>
  IntermediateRepresentationAttributeDeclaration.of({
    name: IntermediateRepresentationAttributeName.of(name),
    kind: AttributeKind.of("int"),
  });

test("attribute catalogs map concrete entries while retaining owner, order, lookup and declarations", () => {
  const first = designAttribute("first");
  const second = designAttribute("second");
  const owner = DesignEntityName.of("Order");
  const emptyOwner = DesignEntityName.of("Empty");
  const catalog = DesignAttributeCatalog.of(
    DesignEntityDeclarations.of([
      DesignEntityDeclaration.of({
        name: owner,
        description: "order metadata",
        attributes: DesignAttributeDeclarations.of([first, second]),
      }),
      DesignEntityDeclaration.of({
        name: emptyOwner,
        description: "empty metadata",
        attributes: DesignAttributeDeclarations.of([]),
      }),
    ]),
  );
  const mapped = catalog.map((entry) =>
    DesignAttributeCatalogEntry.of(entry.owner(), designAttribute(`${entry.attribute().name().asString()}Mapped`)),
  );
  expect([...mapped].map((entry) => entry.path().asString())).toEqual(["Order.firstMapped", "Order.secondMapped"]);
  expect(mapped.declares("Order.firstMapped")).toBe(true);
  expect(mapped.declares("Order.first")).toBe(false);
  expect([...mapped.declarations()][0]?.description()).toBe("order metadata");
  expect([...mapped.declarations()].map((entity) => entity.name().asString())).toEqual(["Order", "Empty"]);
  expect([...mapped.declarations()][1]?.description()).toBe("empty metadata");
  const filtered = catalog.filter(() => false);
  expect([...filtered]).toEqual([]);
  expect([...filtered.declarations()].map((entity) => entity.name().asString())).toEqual(["Order", "Empty"]);
  expect([...filtered.declarations()][0]?.description()).toBe("order metadata");
  const unknownOwner = catalog.map((entry) =>
    DesignAttributeCatalogEntry.of(
      DesignEntityName.of("Invoice"),
      designAttribute(entry.attribute().name().asString()),
    ),
  );
  expect([...unknownOwner].map((entry) => entry.path().asString())).toEqual(["Invoice.first", "Invoice.second"]);
  expect([...unknownOwner.declarations()].map((entity) => entity.name().asString())).toEqual([
    "Order",
    "Empty",
    "Invoice",
  ]);
  const emptyCatalog = DesignAttributeCatalog.of(DesignEntityDeclarations.of([]));
  expect([...emptyCatalog.combine(catalog)].map((entry) => entry.path().asString())).toEqual([
    "Order.first",
    "Order.second",
  ]);
  expect([...catalog.combine(emptyCatalog)].map((entry) => entry.path().asString())).toEqual([
    "Order.first",
    "Order.second",
  ]);
  const invoice = DesignAttributeCatalog.of(
    DesignEntityDeclarations.of([
      DesignEntityDeclaration.of({
        name: DesignEntityName.of("Invoice"),
        description: "invoice metadata",
        attributes: DesignAttributeDeclarations.of([designAttribute("total")]),
      }),
    ]),
  );
  const combined = catalog.combine(invoice);
  expect([...combined].map((entry) => entry.path().asString())).toEqual([
    "Order.first",
    "Order.second",
    "Invoice.total",
  ]);
  expect([...combined.declarations()].map((entity) => entity.name().asString())).toEqual(["Order", "Empty", "Invoice"]);
  expect(() => catalog.combine(catalog)).toThrow(IllegalArgumentException);
  const conflicting = DesignAttributeCatalog.of(
    DesignEntityDeclarations.of([
      DesignEntityDeclaration.of({
        name: owner,
        description: "different metadata",
        attributes: DesignAttributeDeclarations.of([designAttribute("other")]),
      }),
    ]),
  );
  expect(() => catalog.combine(conflicting)).toThrow(IllegalArgumentException);
  expect(() => catalog.map(() => DesignAttributeCatalogEntry.of(owner, designAttribute("same")))).toThrow(
    IllegalArgumentException,
  );
});

test("intermediate attribute catalog map rebuilds its path lookup", () => {
  const owner = IntermediateRepresentationEntityName.of("Account");
  const original = irAttribute("active");
  const entities = IntermediateRepresentationEntityDeclarations.of([
    IntermediateRepresentationEntityDeclaration.of({
      name: owner,
      attributes: IntermediateRepresentationAttributeDeclarations.of([original]),
    }),
  ]);
  const catalog = IntermediateRepresentationAttributeCatalog.of(entities);
  const mapped = catalog.map((entry) =>
    IntermediateRepresentationAttributeEntry.of(entry.owner(), irAttribute("enabled")),
  );
  expect([...mapped].map((entry) => entry.path().asString())).toEqual(["Account.enabled"]);
  expect([...mapped.expressionDiagnostics({ op: "ref", path: "Account.enabled" }, "expr", false)]).toHaveLength(0);
  const secondOwner = IntermediateRepresentationEntityName.of("Profile");
  const secondCatalog = IntermediateRepresentationAttributeCatalog.of(
    IntermediateRepresentationEntityDeclarations.of([
      IntermediateRepresentationEntityDeclaration.of({
        name: secondOwner,
        attributes: IntermediateRepresentationAttributeDeclarations.of([irAttribute("name")]),
      }),
    ]),
  );
  const combined = catalog.combine(secondCatalog);
  expect([...combined].map((entry) => entry.path().asString())).toEqual(["Account.active", "Profile.name"]);
  expect([...combined.expressionDiagnostics({ op: "ref", path: "Profile.name" }, "expr", false)]).toHaveLength(0);
  const duplicateCatalog = IntermediateRepresentationAttributeCatalog.of(
    IntermediateRepresentationEntityDeclarations.of([
      IntermediateRepresentationEntityDeclaration.of({
        name: owner,
        attributes: IntermediateRepresentationAttributeDeclarations.of([original, irAttribute("other")]),
      }),
    ]),
  );
  expect(() =>
    duplicateCatalog.map(() => IntermediateRepresentationAttributeEntry.of(owner, irAttribute("same"))),
  ).toThrow(IllegalArgumentException);
});

test("business reference index map updates membership without changing set order", () => {
  const index = BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([BusinessRuleReference.of("BR1.1")]));
  const mapped = index.map(() => BusinessRuleReference.of("BR2.1"));
  expect([...mapped].map((reference) => reference.asString())).toEqual(["BR2.1"]);
  expect(mapped.has(BusinessRuleReference.of("BR2.1"))).toBe(true);
  expect(mapped.has(BusinessRuleReference.of("BR1.1"))).toBe(false);
  const empty = BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([]));
  expect([...empty.combine(index)].map((reference) => reference.asString())).toEqual(["BR1.1"]);
  expect([...index.combine(empty)].map((reference) => reference.asString())).toEqual(["BR1.1"]);
});

test("event rule catalog map updates the actual event rule and lookup key", () => {
  const obligation = DesignObligation.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    nature: ObligationNature.of("event"),
    origin: DesignObligationOrigin.of("rules"),
    businessRuleReferences: BusinessRuleReferences.of([]),
    functionalRequirementReferences: FunctionalRequirementReferences.of([]),
    trigger: TriggerName.of("go"),
    guard: { op: "bool", value: true },
    effect: {
      op: "eq",
      args: [
        { op: "ref", path: "Order.state", prime: true },
        { op: "enum", value: "open" },
      ],
    },
  });
  const unit = DesignUnit.of({
    unit: UnitName.of("unit"),
    catalog: DesignAttributeCatalog.of(DesignEntityDeclarations.of([])),
    obligations: DesignObligations.of([obligation]),
    machines: DesignMachines.of([]),
    scenarios: DesignScenarios.of([]),
    background: DesignBackgroundAssumptions.of([]),
  });
  const catalog = DesignEventRuleCatalog.of(unit);
  const mapped = catalog.map((event) =>
    DesignEventRule.of({
      reference: DesignObligationIdentifier.of(event.reference().asString()),
      trigger: TriggerName.of("stop"),
      guard: { op: "bool", value: false },
      effect: {
        op: "eq",
        args: [
          { op: "ref", path: "Order.state", prime: true },
          { op: "enum", value: "closed" },
        ],
      },
    }),
  );
  expect(mapped.eventOf(TargetIdentifier.of("DOB-1"))?.trigger().asString()).toBe("stop");
  expect(mapped.eventOf(TargetIdentifier.of("DOB-1"))?.guard()).toEqual({ op: "bool", value: false });
  const empty = DesignEventRuleCatalog.of(
    DesignUnit.of({
      unit: UnitName.of("empty"),
      catalog: DesignAttributeCatalog.of(DesignEntityDeclarations.of([])),
      obligations: DesignObligations.of([]),
      machines: DesignMachines.of([]),
      scenarios: DesignScenarios.of([]),
      background: DesignBackgroundAssumptions.of([]),
    }),
  );
  expect([...empty.combine(catalog)]).toHaveLength(1);
  expect([...catalog.combine(empty)]).toHaveLength(1);
});

test("sibling unit index map keeps changed owners in iteration and lookup", () => {
  const entity = EntityDeclaration.of({
    name: EntityName.of("Order"),
    element: ElementPath.of("Order"),
    attrs: AttributeDeclarations.of([
      AttributeDeclaration.of({
        name: AttributeName.of("total"),
        element: ElementPath.of("Order.total"),
        type: null,
        uniqueIsTrue: false,
        references: null,
        allowed: null,
        def: null,
        minDeclared: false,
        maxDeclared: false,
        min: null,
        max: null,
      }),
    ]),
    rels: RelationshipDeclarations.of([]),
  });
  const index = SiblingUnitIndex.of(KeyedIndex.of([[UnitName.of("one"), EntityDeclarations.of([entity])]]));
  const mapped = index.map((entry) => SiblingUnitIndexEntry.of(UnitName.of("two"), entry.declarations()));
  expect([...mapped].map((entry) => entry.unit().asString())).toEqual(["two"]);
  expect(mapped.hasAnyUnit()).toBe(true);
  expect(mapped.entityDeclaredIn(UnitName.of("two"), entity.name().normalized())).toBe(entity);
  const empty = SiblingUnitIndex.of(KeyedIndex.empty());
  expect([...empty.combine(index)].map((entry) => entry.unit().asString())).toEqual(["one"]);
  expect([...index.combine(empty)].map((entry) => entry.unit().asString())).toEqual(["one"]);
  const twoIndex = SiblingUnitIndex.of(
    KeyedIndex.of([
      [UnitName.of("one"), EntityDeclarations.of([entity])],
      [UnitName.of("two"), EntityDeclarations.of([entity])],
    ]),
  );
  expect(() => twoIndex.map((entry) => SiblingUnitIndexEntry.of(UnitName.of("same"), entry.declarations()))).toThrow(
    IllegalArgumentException,
  );
});
