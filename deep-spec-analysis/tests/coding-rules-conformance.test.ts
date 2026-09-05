import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath, ContentHash, KeyedIndex, QueryLabel, TargetIds } from "@deep-spec/kernel-domain";
import { type Json, IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import {
  FormalModelId, RequirementsModel, ObligationId, ScenarioId, BackgroundAssumptionId,
  SmtQueryVerdict, SmtQueryVerdicts,
} from "@deep-spec/requirements-domain";
import {
  LoweringIndex, DesignObligationId, DesignScenarioId, DesignBackgroundId, DesignMachineId, DesignTransitionId,
} from "@deep-spec/design-domain";
import { parseFormalModel, buildSmtPlan, parseSmtChildResults, Z3SolverClientImpl } from "@deep-spec/requirements-adapter";
import {
  AttrDecl, AttributeName, ElementPath, TypeName, AttributeDefault, NumericBound,
  RuleDecl, DeclaredRuleId, RuleCategory, SourceIds, EntityDecl, EntityName, AttrDecls,
  RelDecl, RelDecls, CardinalityNotation, StateMachineSketch, MachineSpec, StateNames, LineNumber,
  DomainEntitySketch, ComponentName, AttributeNames, DeclaredEntities, EntityDecls, ShapeErrors,
} from "@deep-spec/refcheck-domain";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function model(assertion: Json = { op: "bool", value: false }): RequirementsModel {
  const parsed = parseFormalModel({
    irVersion: "1.0.0", schema: { entities: [] },
    obligations: [{ id: "OB-1", nature: "invariant", frRefs: ["FR-1"], assert: assertion }],
    scenarios: [], background: [],
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return RequirementsModel.of({ ...parsed.value, id: FormalModelId.of(ArtifactPath.of("model.md")), irHash: ContentHash.ofText("fixture"), sourceDocument: new Uint8Array() });
}

describe("SMT response completeness", () => {
  const other = { id: "vac:OB-1", status: "sat" };
  const invalidBatches: { raw: Json; cause: string }[] = [
    { raw: {}, cause: "lacks a results array" },
    { raw: { results: null }, cause: "lacks a results array" },
    { raw: { results: [] }, cause: "omitted query results" },
    { raw: { results: [{ id: "global", status: "sat" }] }, cause: "omitted query results: vac:OB-1" },
    { raw: { results: [{ id: "global", status: "sat" }, { id: "global", status: "unsat" }] }, cause: "duplicate query global" },
    { raw: { results: [{ id: "other", status: "sat" }, other] }, cause: "unexpected query other" },
    { raw: { results: [{ status: "sat" }, other] }, cause: "lacks a query id" },
    { raw: { results: [{ id: "global", status: "invalid" }, other] }, cause: "invalid status" },
    { raw: { results: [{ id: "global", status: "sat", model: { x: 1 } }, other] }, cause: "invalid model" },
    { raw: { results: [{ id: "global", status: "unsat", core: [1] }, other] }, cause: "invalid core" },
    { raw: { results: [{ id: "global", status: "error", error: 1 }, other] }, cause: "invalid error" },
  ];
  test.each(invalidBatches)("rejects an incomplete or invalid batch %#", ({ raw, cause }) => {
    const parsed = parseSmtChildResults(raw, ["global", "vac:OB-1"]);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(cause);
  });

  test.each(["sat", "unsat", "unknown", "budget", "error"])("accepts a complete %s response", (status) => {
    const result = parseSmtChildResults({ results: [{ id: "q", status, model: { x: "1" }, core: ["ob_OB_1"], error: "detail" }] }, ["q"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.get("q")?.status).toBe(status);
  });

  test("matches query identity independently of response order", () => {
    expect(parseSmtChildResults({ results: [{ id: "b", status: "sat" }, { id: "a", status: "unsat" }] }, ["a", "b"]).ok).toBe(true);
    expect(parseSmtChildResults({ results: [] }, []).ok).toBe(true);
    expect(parseSmtChildResults({ results: [{ id: "a", status: "sat" }] }, ["a", "a"]).ok).toBe(false);
  });

  test("a successful child exit with no query result becomes unavailable", () => {
    const dir = mkdtempSync(join(tmpdir(), "incomplete-smt-"));
    const path = join(dir, "child.mjs");
    writeFileSync(path, 'process.stdout.write(JSON.stringify({ results: [] }));');
    try {
      const result = new Z3SolverClientImpl({ selfPath: path, perQueryTimeoutMs: 100, runtimeOverride: "node", workingDirectory: dir }).check(model());
      expect(result.result.kind).toBe("unavailable");
      if (result.result.kind === "unavailable") expect(result.result.reason).toContain("omitted query results: global");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the plan records an absent global result without inventing unissued vacuity queries", () => {
    const input = model();
    const plan = buildSmtPlan(input);
    expect(plan.queries.map((q) => q.id)).toEqual(["global"]);
    const result = plan.plan.interpret(input, SmtQueryVerdicts.of(KeyedIndex.empty()));
    expect(result.findings.toArray()).toHaveLength(0);
    expect(result.skipped.toArray().map((s) => ({ target: s.target().asString(), reason: s.reason() })))
      .toEqual([{ target: "OB-1", reason: "unrecognized-format" }]);
  });

  test("only issued vacuity queries can have missing responses", () => {
    const input = model({ op: "implies", args: [{ op: "bool", value: true }, { op: "bool", value: false }] });
    const plan = buildSmtPlan(input);
    expect(plan.queries.map((q) => q.id)).toEqual(["global", "vac:OB-1"]);
    const result = plan.plan.interpret(input, SmtQueryVerdicts.of(KeyedIndex.of([[QueryLabel.of("global"), SmtQueryVerdict.of({ status: "sat" })]])));
    expect(result.skipped.toArray().map((s) => s.detail())).toEqual(["vacuity check for OB-1 returned no solver result"]);
    expect(SmtQueryVerdict.of({ status: "sat" }).skipsFor(TargetIds.of([]), "completed").toArray()).toHaveLength(0);
  });
});

describe("ID construction contracts match their schema", () => {
  const ids = [
    [ObligationId, "OB"], [ScenarioId, "SC"], [BackgroundAssumptionId, "BG"],
    [DesignObligationId, "DOB"], [DesignScenarioId, "DSC"], [DesignBackgroundId, "DBG"],
    [DesignMachineId, "SM"], [DesignTransitionId, "TR"],
  ] as const;
  for (const [factory, prefix] of ids) {
    test(`${factory.name} rejects invalid values in parse and panics in of`, () => {
      for (const valid of [`${prefix}-1`, `${prefix}-01`, `${prefix}-123456789`]) {
        expect(factory.parse(valid).ok).toBe(true);
        expect(factory.of(valid).asString()).toBe(valid);
      }
      for (const invalid of ["", `${prefix}-invalid`, `${prefix}-`, `${prefix}-1.1`, `${prefix}-1\n`, "OTHER-1"]) {
        expect(factory.parse(invalid).ok).toBe(false);
        expect(() => factory.of(invalid)).toThrow(IllegalArgumentException);
      }
    });
  }

  test("mixed design targets are queried through parse instead of forging a transition ID", () => {
    const index = LoweringIndex.of({ origins: KeyedIndex.empty(), scenarioDesignIds: KeyedIndex.empty(), machinesByTransition: KeyedIndex.empty(), attrPathsByMachine: KeyedIndex.empty() });
    expect(index.isTransition("DOB-1")).toBe(false);
    expect(index.machineOfTransition("DOB-1")).toBeNull();
    expect(index.attrPathOfMachine("TR-1")).toBeNull();
  });

  test("accepted requirement IDs support their ordinary target and comparison operations", () => {
    expect(ObligationId.of("OB-2").compareTo(ObligationId.of("OB-10"))).toBeLessThan(0);
    expect(ObligationId.of("OB-1").asTargetId().asString()).toBe("OB-1");
    expect(ScenarioId.of("SC-1").asTargetId().asString()).toBe("SC-1");
    const parsed = parseFormalModel({ irVersion: "1.0.0", obligations: [{ id: "OB-invalid", nature: "invariant" }] });
    expect(parsed.ok).toBe(false);
  });
});

describe("declarations own their state", () => {
  test("attribute and relationship judgments cannot change through their input records", () => {
    const seed: Mutable<Parameters<typeof AttrDecl.of>[0]> = {
      name: AttributeName.of("count"), element: ElementPath.of("attributes[0]"), type: TypeName.of("integer"), uniqueIsTrue: false,
      references: null, allowed: null, def: AttributeDefault.of(5), minDeclared: true, maxDeclared: true, min: NumericBound.of(0), max: NumericBound.of(10),
    };
    const attribute = AttrDecl.of(seed);
    seed.min = NumericBound.of(20);
    expect(attribute.boundsInverted()).toBe(false);
    expect(attribute.defaultBelowMin()).toBe(false);
    const relationSeed: Mutable<Parameters<typeof RelDecl.of>[0]> = {
      element: ElementPath.of("relationships[0]"), from: EntityName.of("Order"), to: EntityName.of("Line"), cardinality: CardinalityNotation.of("1:N"), hasDirection: true,
    };
    const relation = RelDecl.of(relationSeed);
    relationSeed.hasDirection = false;
    expect(relation.cardinalityWithoutDirection()).toBe(false);
  });

  test("rule missing fields are a snapshot", () => {
    const missing: string[] = [];
    const seed: Mutable<Parameters<typeof RuleDecl.of>[0]> = {
      id: DeclaredRuleId.of("BR1.1"), element: ElementPath.of("rules[0]"), category: RuleCategory.of("constraint"), appliesTo: null, sourceIds: SourceIds.of([]), missing,
    };
    const rule = RuleDecl.of(seed);
    missing.push("statement");
    seed.id = DeclaredRuleId.of("BR2.1");
    expect(rule.missing()).toEqual([]);
    expect(rule.id()?.asString()).toBe("BR1.1");
  });

  test("entity declarations and sketches keep their captured identities", () => {
    const seed = { name: EntityName.of("Order"), element: ElementPath.of("entities[0]"), attrs: AttrDecls.of([]), rels: RelDecls.of([]) };
    const entity = EntityDecl.of(seed);
    seed.name = EntityName.of("Customer");
    expect(entity.name().asString()).toBe("Order");
    const sketchSeed = { name: EntityName.of("Order"), component: ComponentName.of("Sales"), attributes: AttributeNames.of([]) };
    const sketch = DomainEntitySketch.of(sketchSeed);
    sketchSeed.component = ComponentName.of("Shipping");
    expect(sketch.catalogLabel()).toBe("entity Order (component Sales)");
  });

  test("machine and declaration collections do not keep their input record", () => {
    const seed: Mutable<Parameters<typeof StateMachineSketch.of>[0]> = { spec: MachineSpec.of("Order"), states: StateNames.of([]), fenceLine: LineNumber.of(1), unsupported: null };
    const machine = StateMachineSketch.of(seed);
    seed.unsupported = "changed";
    expect(machine.unsupported()).toBeNull();
    const declaredSeed = { entities: EntityDecls.of([]), rels: RelDecls.of([]), shapeErrors: ShapeErrors.of([]) };
    const declared = DeclaredEntities.of(declaredSeed);
    declaredSeed.entities = EntityDecls.of([EntityDecl.of({ name: EntityName.of("Order"), element: ElementPath.of("entities[0]"), attrs: AttrDecls.of([]), rels: RelDecls.of([]) })]);
    expect(declared.entities().toArray()).toEqual([]);
  });
});
