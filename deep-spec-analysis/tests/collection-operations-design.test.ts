import { expect, test } from "bun:test";
import {
  AttributeMapping,
  AttributeMappings,
  AttributePaths,
  BusinessRuleReference,
  BusinessRuleReferenceIndex,
  BusinessRuleReferences,
  DesignAssignment,
  DesignAssignments,
  DesignAttributeCatalog,
  DesignAttributeCatalogEntry,
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignBackgroundAssumptions,
  DesignEntityDeclaration,
  DesignEntityDeclarations,
  DesignEntityName,
  DesignEventRuleCatalog,
  type DesignMachine,
  DesignMachines,
  DesignObligation,
  DesignObligationIdentifier,
  DesignObligationOrigin,
  DesignObligations,
  DesignScenarios,
  DesignUnit,
  DesignUnitIdentifier,
  EventMappings,
  InitialState,
  InitialStates,
  MachineReachability,
  type ReachabilityProbe,
  ReachabilityVerdict,
  RefinementQueryVerdict,
  RefinementQueryVerdictEntry,
  RefinementQueryVerdicts,
  RefinementUnitMap,
  RefinementUnitMaps,
  UnformalizedTargets,
  UnmappedDeclarations,
} from "@deep-spec-analysis/design-domain";
import {
  AttributeKind,
  AttributePath,
  ExpressionTree,
  FunctionalRequirementReferences,
  ImmutableFirstClassCollection,
  ObligationNature,
  QueryLabel,
  TargetIdentifier,
  TriggerName,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

test("代表的な設計コレクションは順序・値同値・不変性を公開操作で提供する", () => {
  const first = AttributeMapping.of(AttributePath.of("Order.total"), {
    kind: "expression",
    expr: { op: "int", value: 1 },
  });
  const second = AttributeMapping.of(AttributePath.of("Order.total"), {
    kind: "expression",
    expr: { op: "int", value: 2 },
  });
  const input = [first, second];
  const mappings = AttributeMappings.of(input);
  input.length = 0;

  expect(mappings.at(0).equals(first)).toBe(true);
  expect(mappings.head().equals(first)).toBe(true);
  expect([...mappings.tail()].map((value) => value.equals(second))).toEqual([true]);
  expect(mappings.tail()).toBeInstanceOf(AttributeMappings);
  expect(
    mappings.include(
      AttributeMapping.of(AttributePath.of("Order.total"), {
        kind: "expression",
        expr: { op: "int", value: 2 },
      }),
    ),
  ).toBe(true);
  expect(
    mappings.include(
      AttributeMapping.of(AttributePath.of("Order.total"), {
        kind: "expression",
        expr: { op: "int", value: 3 },
      }),
    ),
  ).toBe(false);
  expect(mappings.exists((value) => value.equals(second))).toBe(true);
  expect(mappings.filter((value) => value.equals(second))).toBeInstanceOf(AttributeMappings);
  expect([...mappings.filter((value) => value.equals(second))].map((value) => value.equals(second))).toEqual([true]);

  const mapped = mappings.map((value) => InitialState.of(value.req().asString()));
  expect(mapped).toBeInstanceOf(ImmutableFirstClassCollection);
  expect([...mapped].map((value) => value.asString())).toEqual(["Order.total", "Order.total"]);
  expect([...mappings].map((value) => value.equals(first) || value.equals(second))).toEqual([true, true]);
});

test("位置境界・空結果・existsの短絡を検証する", () => {
  const empty = InitialStates.of([]);
  expect(empty.isEmpty()).toBe(true);
  expect(() => empty.head()).toThrow(IllegalArgumentException);
  expect(() => empty.tail()).toThrow(IllegalArgumentException);
  expect(() => empty.at(-1)).toThrow(IllegalArgumentException);
  expect(() => empty.at(0)).toThrow(IllegalArgumentException);
  const values = InitialStates.of([InitialState.of("open"), InitialState.of("closed")]);
  expect(() => values.at(2)).toThrow(IllegalArgumentException);
  let calls = 0;
  expect(
    values.exists((value) => {
      calls += 1;
      return value.matchesName("open");
    }),
  ).toBe(true);
  expect(calls).toBe(1);
  const filtered = values.filter(() => false);
  expect(filtered).toBeInstanceOf(InitialStates);
  expect(filtered.isEmpty()).toBe(true);
});

test("配列長を偽装したFCC入力も実走査予算で拒否する", () => {
  const input = [InitialState.of("open")];
  input[Symbol.iterator] = function* () {
    for (let index = 0; index < 65_537; index++) yield InitialState.of(index % 2 === 0 ? "open" : "closed");
    return undefined;
  };
  expect(() => InitialStates.of(input)).toThrow(IllegalArgumentException);
  const parsed = InitialStates.parse(input);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.kind).toBe("too-many-initial-states");
});

test("KeySetを使う設計コレクションは再構築後も集合の意味を保つ", () => {
  const reference = BusinessRuleReference.of("BR1.1");
  const index = BusinessRuleReferenceIndex.of(BusinessRuleReferences.of([reference]));
  expect([...index].map((value) => value.asString())).toEqual(["BR1.1"]);
  expect(index.tail()).toBeInstanceOf(BusinessRuleReferenceIndex);
  expect(index.tail().isEmpty()).toBe(true);
  expect(index.filter((value) => value.equals(BusinessRuleReference.of("BR1.1"))).isEmpty()).toBe(false);

  const path = AttributePath.of("Order.total");
  const paths = AttributePaths.of([path, AttributePath.of("Order.total")]);
  expect([...paths]).toHaveLength(1);
  expect(paths.include(AttributePath.of("Order.total"))).toBe(true);
  expect(paths.filter(() => false).isEmpty()).toBe(true);
});

test("文脈を持つカタログとキー付き代入はtail/filter後も公開検索面を保持する", () => {
  const attribute = DesignAttributeDeclaration.of({
    name: DesignAttributeName.of("total"),
    kind: AttributeKind.of("int"),
  });
  const entity = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Order"),
    attributes: DesignAttributeDeclarations.of([attribute]),
  });
  const secondEntity = DesignEntityDeclaration.of({
    name: DesignEntityName.of("Invoice"),
    attributes: DesignAttributeDeclarations.of([attribute]),
  });
  const catalog = DesignAttributeCatalog.of(DesignEntityDeclarations.of([entity, secondEntity]));
  const parsedEntry = DesignAttributeCatalogEntry.parse(DesignEntityName.of("Order"), attribute);
  expect(parsedEntry.ok).toBe(true);
  if (parsedEntry.ok) expect(parsedEntry.value.path().asString()).toBe("Order.total");
  expect(catalog.at(0).attribute().equals(attribute)).toBe(true);
  expect(catalog.at(0).owner().asString()).toBe("Order");
  expect(catalog.at(1).owner().asString()).toBe("Invoice");
  expect(
    catalog
      .filter(() => true)
      .paths()
      .toArray()
      .map((value) => value.asString()),
  ).toEqual(["Order.total", "Invoice.total"]);
  expect(
    catalog
      .tail()
      .paths()
      .toArray()
      .map((value) => value.asString()),
  ).toEqual(["Invoice.total"]);

  const assignment = DesignAssignment.of(pathOf("Order.total"), ExpressionTree.of({ op: "int", value: 1 }));
  const assignments = DesignAssignments.of([assignment]);
  expect(
    assignments.include(DesignAssignment.of(pathOf("Order.total"), ExpressionTree.of({ op: "int", value: 1 }))),
  ).toBe(true);
  expect(assignments.filter(() => true).rhsOf(pathOf("Order.total"))).toEqual({ op: "int", value: 1 });
  expect(assignments.tail().isEmpty()).toBe(true);
});

test("キーを値に結合した判定エントリはqueryの文脈を保持する", () => {
  const query = QueryLabel.of("q1");
  const verdict = RefinementQueryVerdict.of({ status: "sat" });
  const values = RefinementQueryVerdicts.of([RefinementQueryVerdictEntry.of(query, verdict)]);
  expect(values.verdictOf(QueryLabel.of("q1"))?.isSat()).toBe(true);
  const entry = values.head();
  expect(entry.query().asString()).toBe("q1");
  expect(entry.verdict().equals(verdict)).toBe(true);
  expect(
    values
      .filter((candidate) => candidate.query().equals(QueryLabel.of("q1")))
      .head()
      .equals(entry),
  ).toBe(true);
  expect(values.map((candidate) => InitialState.of(candidate.query().asString()))).toBeInstanceOf(
    ImmutableFirstClassCollection,
  );
  expect(values.verdictOf(query)?.equals(verdict)).toBe(true);
});

test("RefinementUnitMap の等価性は unit だけでなく写像内容を含む", () => {
  const unit = DesignUnitIdentifier.of("u1");
  const empty = RefinementUnitMap.of({
    unit,
    attrMap: AttributeMappings.of([]),
    eventMap: EventMappings.of([]),
    unmapped: UnmappedDeclarations.of([]),
  });
  const mapped = RefinementUnitMap.of({
    unit: DesignUnitIdentifier.of("u1"),
    attrMap: AttributeMappings.of([
      AttributeMapping.of(AttributePath.of("Order.total"), { kind: "expression", expr: { op: "int", value: 1 } }),
    ]),
    eventMap: EventMappings.of([]),
    unmapped: UnmappedDeclarations.of([]),
  });
  expect(empty.equals(mapped)).toBe(false);
  expect(RefinementUnitMaps.of([empty]).include(mapped)).toBe(false);
});

test("MachineReachability の等価性は bounded・probe・観測状態を含む", () => {
  const unit = { name: () => "u1", equals: () => true } as unknown as DesignUnit;
  const machine = { equals: () => true } as unknown as DesignMachine;
  const probe = {
    unit: () => unit,
    attributePath: () => "Order.status",
    state: () => "open",
  } as unknown as ReachabilityProbe;
  const observations = new Map([[probe, ReachabilityVerdict.reached()]]);
  const bounded = MachineReachability.of({ unit, machine, probes: [probe], bounded: true, observations });
  const unbounded = MachineReachability.of({
    unit,
    machine,
    probes: [probe],
    bounded: false,
    observations: new Map(),
  });
  expect(bounded.equals(bounded)).toBe(true);
  expect(bounded.equals(unbounded)).toBe(false);
});

test("EventRuleCatalogはunit由来のキーと規則を再構築後も保持する", () => {
  const attribute = DesignAttributeDeclaration.of({
    name: DesignAttributeName.of("total"),
    kind: AttributeKind.of("int"),
  });
  const unit = DesignUnit.of({
    unit: UnitName.of("u1-orders"),
    catalog: DesignAttributeCatalog.of(
      DesignEntityDeclarations.of([
        DesignEntityDeclaration.of({
          name: DesignEntityName.of("Order"),
          attributes: DesignAttributeDeclarations.of([attribute]),
        }),
      ]),
    ),
    obligations: DesignObligations.of([
      DesignObligation.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        nature: ObligationNature.of("event"),
        origin: DesignObligationOrigin.of(""),
        businessRuleReferences: BusinessRuleReferences.of([]),
        functionalRequirementReferences: FunctionalRequirementReferences.of([]),
        trigger: TriggerName.of("pay"),
        guard: { op: "bool", value: true },
        effect: {
          op: "eq",
          args: [
            { op: "ref", path: "Order.total", prime: true },
            { op: "int", value: 1 },
          ],
        },
      }),
    ]),
    machines: DesignMachines.of([]),
    scenarios: DesignScenarios.of([]),
    background: DesignBackgroundAssumptions.of([]),
  });
  const events = DesignEventRuleCatalog.of(unit);
  expect(events.eventOf(TargetIdentifier.of("DOB-1"))?.reference().asString()).toBe("DOB-1");
  expect(
    events
      .filter(() => true)
      .eventOf(TargetIdentifier.of("DOB-1"))
      ?.reference()
      .asString(),
  ).toBe("DOB-1");
  expect(events.tail().isEmpty()).toBe(true);
});

function pathOf(value: string): AttributePath {
  return AttributePath.of(value);
}

test("集合のaddも件数上限を守り、上限での既存要素の再追加は有効", () => {
  const paths = AttributePaths.of(Array.from({ length: 65_536 }, (_, index) => AttributePath.of(`Order.a${index}`)));
  expect(paths.add(AttributePath.of("Order.a0")).has(AttributePath.of("Order.a0"))).toBe(true);
  expect(() => paths.add(AttributePath.of("Order.extra"))).toThrow(IllegalArgumentException);
  expect(paths.has(AttributePath.of("Order.extra"))).toBe(false);
  const targets = UnformalizedTargets.of(
    Array.from({ length: 65_536 }, (_, index) => TargetIdentifier.of(`OB-${index}`)),
  );
  expect(targets.add(TargetIdentifier.of("OB-0")).covers(TargetIdentifier.of("OB-0"))).toBe(true);
  expect(() => targets.add(TargetIdentifier.of("OB-65536"))).toThrow(IllegalArgumentException);
  expect(targets.covers(TargetIdentifier.of("OB-65536"))).toBe(false);
});
