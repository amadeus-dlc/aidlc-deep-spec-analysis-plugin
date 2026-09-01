// レイヤード refinement パイプラインの in-process 検証（PR6、#19）。
//
// 1) golden 同値：refinement fixture（要件モデル＋map＋設計モデル）を tmp へ
//    複製し、両 design interactor を実 Impl（実 v1 兄弟・実 z3 子）で駆動して、
//    書かれた smt.json / quint.json / cross-check.json を期待 golden とバイト
//    比較する。Phase 3 込みの独立第 2 経路。
// 2) SMT スクリプトのキャラクタライゼーション：両コンパイラ（v1 計画ビルダ・
//    refinement 第 2 コンパイラ）の生成物を fixture スナップショットと逐語比較
//    ——PR8（コンパイラ統一の判断点）の安全網。
// 3) ドメイン検査の分岐固定：alpha・計画分類・カタログ・解釈・status-skips の
//    各純関数を直接駆動する（refinement/domain の 90% 床）。

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Json } from "../tools/kernel/adapter/index.ts";
import { SystemClock } from "../tools/kernel/adapter/index.ts";
import { TriggerName, FrRefs, ContentHash, ArtifactPath } from "../tools/kernel/domain/index.ts";
import type { Expression } from "../tools/kernel/domain/index.ts";
import { AttributeBound, AttributePath, FormalModelId, ObligationId, ObligationNature, ScenarioId } from "../tools/requirements/domain/index.ts";
// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import { DesignBackgroundId, DesignAttributeName, DesignEntityName, DesignMachineId, DesignObligationId, DesignObligationNature, DesignObligationOrigin, DesignScenarioId, DesignTransitionId, AttrPaths, DesignBackgroundAssumptions, DesignMachines, DesignObligations, DesignScenarios, type DesignBackgroundAssumption, type DesignMachine, DesignObligation, DesignScenario, type DesignIgnore, type DesignTransition, type DesignValue, BrRefs, DesignIgnores, DesignModelId, DesignSkips, DesignTransitions, DesignUnit, DesignUnitId, InitialStates, RefinementMaterialsId } from "../tools/design/domain/index.ts";
import { type DesignUnit as DesignUnitType } from "../tools/design/domain/index.ts";
import {
  DesignModelRepositoryImpl,
  DesignReportRepositoryImpl,
  RefinementMaterialsRepositoryImpl,
  RefinementSolverClientImpl,
  SiblingBackendClientImpl,
  buildRefinementQueries,
  decodeDesignModel,
  type RefinementSmtContext,
  RefinementMapRepositoryImpl,
} from "../tools/design/adapter/index.ts";
import { VerifyDesignQuintUseCase, VerifyDesignSmtUseCase } from "../tools/design/usecase/index.ts";
import {
  AlphaContext,
  AlphaError,
  AttributeMappings,
  DesignEventCatalog,
  EffectAssignments,
  EventMappings,
  RefinementAttributes,
  RefinementObligations,
  RefinementQueryVerdicts,
  RefinementQuintInvariants,
  RefinementUnitMaps,
  RefinementRequirements,
  RefinementScenarios,
  RefinementSolverFacts,
  ReqAttributeValues,
  TransitionRef,
  TransitionRefs,
  UnitRefinementPlan,
  UnmappedDeclarations,
  UnmappedTargetRef,
  type AttributeMapping,
  type EventMapping,
  type RefinementAttribute,
  RefinementObligation,
  type RefinementProbe,
  RefinementQueryVerdict,
  RefinementScenario,
  type RefinementUnitMap,
  RefinementMaterials,
  RefinementMapId,
} from "../tools/refinement/domain/index.ts";
import { FormalModelRepositoryImpl, buildSmtPlan } from "../tools/requirements/adapter/index.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures", "refinement");
const findingsSchemaPath = join(toolsDir, "data", "deep-spec-findings-schema.json");
const mapSchemaPath = join(toolsDir, "data", "deep-spec-refinement-map-schema.json");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");
const MODEL_RELPATH = ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"];

function golden(file: string): string {
  return readFileSync(join(fixtures, "expected", file), "utf-8");
}

function wiring(record: string) {
  const modelPath = join(record, ...MODEL_RELPATH);
  const verifyDir = join(dirname(modelPath), "deep-spec-design-verify");
  const reports = new DesignReportRepositoryImpl(findingsSchemaPath);
  const sibling = new SiblingBackendClientImpl({
    toolsDirectory: toolsDir,
    workingDirectory: pluginRoot,
    spawnEnvironment: { ...process.env, AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation", AIDLC_DEEP_SPEC_QUINT_BIN: quintBin },
  });
  const contexts = new RefinementMaterialsRepositoryImpl(mapSchemaPath);
  const solver = new RefinementSolverClientImpl({
    childHostPath: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
    perQueryTimeoutMs: 2000,
    runtimeOverride: undefined,
    workingDirectory: pluginRoot,
  });
  return { modelPath, verifyDir, reports, sibling, contexts, solver };
}

describe("in-process golden equivalence (both interactors, phase 3 included)", () => {
  test("smt + quint + converged cross-check reproduce the refinement golden bytes", () => {
    const record = mkdtempSync(join(tmpdir(), "refinement-usecase-"));
    try {
      cpSync(join(fixtures, "record"), record, { recursive: true });
      const w = wiring(record);
      const smt = new VerifyDesignSmtUseCase(
        new DesignModelRepositoryImpl(),
        w.reports,
        w.sibling,
        w.contexts,
        w.solver,
        new SystemClock(),
      ).execute({ modelId: DesignModelId.of(ap(w.modelPath)), verifyDirectory: ap(w.verifyDir) });
      expect(smt.kind).toBe("verified");
      expect(readFileSync(join(w.verifyDir, "smt.json"), "utf-8")).toBe(golden("smt.json"));

      const quint = new VerifyDesignQuintUseCase(
        new DesignModelRepositoryImpl(),
        w.reports,
        w.sibling,
        w.contexts,
        new SystemClock(),
        2,
      ).execute({ modelId: DesignModelId.of(ap(w.modelPath)), verifyDirectory: ap(w.verifyDir) });
      expect(quint.kind).toBe("verified");
      expect(readFileSync(join(w.verifyDir, "quint.json"), "utf-8")).toBe(golden("quint.json"));
      expect(readFileSync(join(w.verifyDir, "cross-check.json"), "utf-8")).toBe(golden("cross-check.json"));
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  }, 180_000);
});

describe("SMT script characterization (the PR8 safety net)", () => {
  const snapshot = (name: string, value: Json): void => {
    const path = join(pluginRoot, "tests", "fixtures", "smt-scripts", name);
    expect(`${JSON.stringify(value, null, 2)}\n`).toBe(readFileSync(path, "utf-8"));
  };

  test("the v1 plan builder emits byte-identical scripts for the conformance model", () => {
    const acquired = new FormalModelRepositoryImpl().findById(
      FormalModelId.of(ap(join(pluginRoot, "tests", "fixtures", "conformance", "deep-spec-analysis-formal-model.md"))),
    );
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const plan = buildSmtPlan(acquired.value);
    snapshot("v1-plan-queries.json", plan.queries as unknown as Json);
  });

  test("the second (refinement) compiler emits byte-identical scripts for the refinement fixture", () => {
    const modelPath = join(fixtures, "record", ...MODEL_RELPATH);
    const acquired = new DesignModelRepositoryImpl().findById(DesignModelId.of(ap(modelPath)));
    const context = new RefinementMaterialsRepositoryImpl(mapSchemaPath).findById(RefinementMaterialsId.ofModel(DesignModelId.of(ap(modelPath))));
    expect(acquired.ok && context.isActive()).toBe(true);
    if (!acquired.ok || !context.isActive()) return;
    const acq = context.mapAcquisition();
    expect(acq.kind === "loaded").toBe(true);
    if (acq.kind !== "loaded") return;
    const req = context.requirements();
    expect(acq.map.units().toArray().length).toBeGreaterThan(0);
    expect(acq.map.unitMapOf(DesignUnitId.of("no-such-unit"))).toBe(undefined);
    expect(acq.map.id().artifactPath().asString().endsWith("deep-spec-analysis-refinement-map.md")).toBe(true);
    expect(req.id().artifactPath().asString().endsWith("deep-spec-analysis-formal-model.md")).toBe(true);
    const queries: Json[] = [];
    for (const u of acquired.value.units()) {
      const unitMap = acq.map.unitMapOf(u.id());
      if (!unitMap) continue;
      const plan = UnitRefinementPlan.of(u, unitMap, req, acq.mapArtifact);
      queries.push(...(buildRefinementQueries(u, req, plan).queries as unknown as Json[]));
    }
    snapshot("refinement-queries.json", queries as unknown as Json);
  });
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

// テストの読みやすさのため素の配列・素の文字列で書き、ここで一括して DP と
// コレクションに包む。
type RawDesignObligation = Omit<Parameters<typeof DesignObligation.reconstitute>[0], "id" | "nature" | "origin" | "brRefs" | "frRefs"> & {
  id: string;
  nature: string;
  origin: string;
  brRefs: string[];
  frRefs: string[];
};
type RawDesignTransition = Omit<DesignTransition, "id" | "brRefs" | "trigger"> & { id: string; brRefs: string[]; trigger: string };
type RawDesignMachine = Omit<DesignMachine, "id" | "entity" | "attribute" | "initial" | "transitions" | "ignores"> & {
  id: string;
  entity: string;
  attribute: string;
  initial: string[];
  transitions: RawDesignTransition[];
  ignores: DesignIgnore[];
};
type RawDesignScenario = Omit<Parameters<typeof DesignScenario.reconstitute>[0], "id" | "brRefs" | "frRefs"> & { id: string; brRefs: string[]; frRefs: string[] };
function unit(seed: {
  unit?: string;
  rawEntities?: DesignValue;
  attrPaths?: Set<string>;
  obligations?: RawDesignObligation[];
  machines?: RawDesignMachine[];
  scenarios?: RawDesignScenario[];
  background?: (Omit<DesignBackgroundAssumption, "id"> & { id: string })[];
}): DesignUnitType {
  return DesignUnit.reconstitute({
    unit: seed.unit ?? "u1",
    rawEntities: seed.rawEntities ?? [],
    attrPaths: AttrPaths.of([...(seed.attrPaths ?? new Set<string>())]),
    obligations: DesignObligations.of(
      (seed.obligations ?? []).map((o) => DesignObligation.reconstitute({
        ...o,
        id: DesignObligationId.reconstitute(o.id),
        nature: DesignObligationNature.reconstitute(o.nature),
        origin: DesignObligationOrigin.reconstitute(o.origin),
        brRefs: BrRefs.of(o.brRefs),
        frRefs: FrRefs.of(o.frRefs),
      })),
    ),
    machines: DesignMachines.of(
      (seed.machines ?? []).map((m) => ({
        ...m,
        id: DesignMachineId.reconstitute(m.id),
        entity: DesignEntityName.reconstitute(m.entity),
        attribute: DesignAttributeName.reconstitute(m.attribute),
        initial: InitialStates.of(m.initial),
        transitions: DesignTransitions.of(
          m.transitions.map((t) => ({ ...t, id: DesignTransitionId.reconstitute(t.id), brRefs: BrRefs.of(t.brRefs), trigger: TriggerName.reconstitute(t.trigger) })),
        ),
        ignores: DesignIgnores.of(m.ignores),
      })),
    ),
    scenarios: DesignScenarios.of(
      (seed.scenarios ?? []).map((s) => DesignScenario.reconstitute({ ...s, id: DesignScenarioId.reconstitute(s.id), brRefs: BrRefs.of(s.brRefs), frRefs: FrRefs.of(s.frRefs) })),
    ),
    background: DesignBackgroundAssumptions.of(
      (seed.background ?? []).map((b) => ({ ...b, id: DesignBackgroundId.reconstitute(b.id) })),
    ),
  });
}

// テストの読みやすさのため素の配列・素の id で書き、ここで一括して DP と
// コレクションに包む（アダプタの門と同型）。
type RawReqAttribute = Omit<RefinementAttribute, "path" | "min" | "max" | "values"> & { path: string; min?: number; max?: number; values?: string[] };
type RawReqObligation = Omit<Parameters<typeof RefinementObligation.reconstitute>[0], "id" | "nature" | "frRefs" | "trigger"> & { id: string; nature: string; frRefs: string[]; trigger?: string };
type RawReqScenario = Omit<Parameters<typeof RefinementScenario.reconstitute>[0], "id" | "frRefs" | "event"> & { id: string; frRefs: string[]; event?: { trigger: string } };
function requirements(seed: {
  attributes?: RawReqAttribute[];
  obligations?: RawReqObligation[];
  scenarios?: RawReqScenario[];
}): RefinementRequirements {
  return RefinementRequirements.reconstitute({
    id: FormalModelId.of(ap("/test/deep-spec-analysis-formal-model.md")),
    hash: ContentHash.reconstitute("a".repeat(64)),
    attributes: RefinementAttributes.of(
      (seed.attributes ?? []).map((a) => ({
        ...a,
        path: AttributePath.reconstitute(a.path),
        min: a.min === undefined ? undefined : AttributeBound.reconstitute(a.min),
        max: a.max === undefined ? undefined : AttributeBound.reconstitute(a.max),
        values: a.values === undefined ? undefined : ReqAttributeValues.of(a.values),
      })),
    ),
    obligations: RefinementObligations.of(
      (seed.obligations ?? []).map((o) => RefinementObligation.reconstitute({
        ...o,
        id: ObligationId.reconstitute(o.id),
        nature: ObligationNature.reconstitute(o.nature),
        frRefs: FrRefs.of(o.frRefs),
        trigger: o.trigger === undefined ? undefined : TriggerName.reconstitute(o.trigger),
      })),
    ),
    scenarios: RefinementScenarios.of(
      (seed.scenarios ?? []).map((s) => RefinementScenario.reconstitute({
        ...s,
        id: ScenarioId.reconstitute(s.id),
        frRefs: FrRefs.of(s.frRefs),
        event: s.event === undefined ? undefined : { trigger: TriggerName.reconstitute(s.event.trigger) },
      })),
    ),
  });
}

type RawAttributeMapping =
  | { kind: "expression"; req: string; expr: Expression }
  | { kind: "enum-cases"; req: string; from: string; cases: { [designValue: string]: string } }
  | { kind: "unspecified"; req: string };
type RawEventMapping = Omit<EventMapping, "reqTrigger" | "transitions"> & { reqTrigger: string; transitions: string[] };
type RawUnmappedTarget = { target: string; reason: string };
function wrapMapping(m: RawAttributeMapping): AttributeMapping {
  return { ...m, req: AttributePath.reconstitute(m.req) } as AttributeMapping;
}
function refUnitMap(seed: {
  unit?: string;
  attrMap?: RawAttributeMapping[];
  eventMap?: RawEventMapping[];
  unmapped?: RawUnmappedTarget[];
}): RefinementUnitMap {
  return {
    unit: DesignUnitId.of(seed.unit ?? "u1"),
    attrMap: AttributeMappings.of((seed.attrMap ?? []).map(wrapMapping)),
    eventMap: EventMappings.of(
      (seed.eventMap ?? []).map((e) => ({ ...e, reqTrigger: TriggerName.reconstitute(e.reqTrigger), transitions: TransitionRefs.of(e.transitions.map((t) => TransitionRef.reconstitute(t))) })),
    ),
    unmapped: UnmappedDeclarations.of(
      (seed.unmapped ?? []).map((un) => ({ ...un, target: UnmappedTargetRef.reconstitute(un.target) })),
    ),
  };
}

const exprMapping = (req: string, path: string) =>
  ({ kind: "expression", req, expr: { op: "ref", path } }) as const;
const enumMapping = (req: string, from: string, cases: { [d: string]: string }) =>
  ({ kind: "enum-cases", req, from, cases }) as const;

describe("alpha substitution", () => {
  const ctx = AlphaContext.of(
    new Map<string, AttributeMapping>([
      ["R.flag", wrapMapping(exprMapping("R.flag", "D.flag"))],
      ["R.state", wrapMapping(enumMapping("R.state", "D.phase", { draft: "open", review: "open", done: "closed" }))],
      ["R.none", wrapMapping({ kind: "unspecified", req: "R.none" })],
    ]),
  );

  test("enum eq expands to the disjunction of design values mapping to the literal", () => {
    const out = ctx.substitute({ op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "open" }] }, false);
    expect(out).toEqual({
      op: "or",
      args: [
        { op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "draft" }] },
        { op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "review" }] },
      ],
    });
    const single = ctx.substitute({ op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "closed" }] }, false);
    expect(single).toEqual({ op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "done" }] });
    const none = ctx.substitute({ op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "ghost" }] }, false);
    expect(none).toEqual({ op: "bool", value: false });
    const ne = ctx.substitute({ op: "ne", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "closed" }] }, false);
    expect(ne.op).toBe("not");
    const primed = ctx.substitute({ op: "eq", args: [{ op: "ref", path: "R.state", prime: true }, { op: "enum", value: "closed" }] }, false);
    expect(primed).toEqual({ op: "eq", args: [{ op: "ref", path: "D.phase", prime: true }, { op: "enum", value: "done" }] });
  });

  test("expression mappings substitute (primed in post context) and errors are frozen", () => {
    expect(ctx.substitute({ op: "ref", path: "R.flag" }, false)).toEqual({ op: "ref", path: "D.flag" });
    expect(ctx.substitute({ op: "ref", path: "R.flag" }, true)).toEqual({ op: "ref", path: "D.flag", prime: true });
    expect(ctx.substitute({ op: "and", args: [{ op: "ref", path: "R.flag" }, { op: "bool", value: true }] }, false).args?.[0]).toEqual({ op: "ref", path: "D.flag" });
    expect(() => ctx.substitute({ op: "ref", path: "R.missing" }, false)).toThrow(AlphaError);
    expect(() => ctx.substitute({ op: "ref", path: "R.state" }, false))
      .toThrow('enum-mapped requirements attribute "R.state" is only legal inside eq/ne against an enum literal');
    expect(() => ctx.substitute({ op: "ref", path: "R.none" }, false))
      .toThrow('attrMap entry for "R.none" declares neither an expression nor enum cases');
  });

  test("alphaEquality builds frame equalities: expression eq, enum class-iff, null for unmapped/unspecified", () => {
    expect(ctx.equalityFor("R.flag")).toEqual({
      op: "eq",
      args: [{ op: "ref", path: "D.flag" }, { op: "ref", path: "D.flag", prime: true }],
    });
    const enumEq = ctx.equalityFor("R.state");
    expect(enumEq?.op).toBe("and");
    expect(enumEq?.args?.length).toBe(2); // closed / open の 2 類
    expect(ctx.equalityFor("R.missing")).toBe(null);
    expect(ctx.equalityFor("R.none")).toBe(null);
  });
});

describe("plan classification and gap findings", () => {
  const designUnit = unit({
    unit: "u1",
    rawEntities: [
      { name: "D", attributes: [{ name: "phase", type: { kind: "enum", values: ["draft", "done"] } }, { name: "flag", type: { kind: "bool" } }] },
    ],
    attrPaths: new Set(["D.phase", "D.flag"]),
    machines: [
      {
        id: "SM-1",
        entity: "D",
        attribute: "phase",
        initial: ["draft"],
        deterministic: true,
        ignores: [],
        transitions: [{ id: "TR-1", from: "draft", to: "done", trigger: "finish", brRefs: [] }],
      },
    ],
  });
  const req = requirements({
    attributes: [
      { path: "R.state", kind: "enum", values: ["open", "closed"] },
      { path: "R.flag", kind: "bool" },
      { path: "R.orphan", kind: "int" },
    ],
    obligations: [
      { id: "OB-1", nature: "invariant", frRefs: ["FR-1"], assert: { op: "ref", path: "R.flag" } },
      { id: "OB-2", nature: "event", frRefs: ["FR-2"], trigger: "finish", guard: { op: "ref", path: "R.flag" }, effect: { op: "eq", args: [{ op: "ref", path: "R.state", prime: true }, { op: "enum", value: "closed" }] } },
      { id: "OB-3", nature: "state-temporal", frRefs: [] },
      { id: "OB-4", nature: "invariant", frRefs: [], assert: { op: "ref", path: "R.orphan" } },
      { id: "OB-5", nature: "event", frRefs: [], trigger: "ghost", guard: { op: "ref", path: "R.flag" }, effect: { op: "eq", args: [{ op: "ref", path: "R.state", prime: true }, { op: "enum", value: "open" }] } },
      { id: "OB-6", nature: "mystery", frRefs: [] },
    ],
    scenarios: [
      { id: "SC-1", kind: "accept", frRefs: [], bindings: { "R.flag": true } },
      { id: "SC-2", kind: "reject", frRefs: [], bindings: { "R.orphan": 1 } },
      { id: "SC-3", kind: "accept", frRefs: [], bindings: {}, event: { trigger: "go" } },
      { id: "SC-4", kind: "accept", frRefs: [], bindings: { "R.waived": 1 } },
    ],
  });
  const unitMap: RefinementUnitMap = refUnitMap({
    attrMap: [
      enumMapping("R.state", "D.phase", { draft: "open", done: "closed" }),
      exprMapping("R.flag", "D.flag"),
    ],
    eventMap: [
      { reqTrigger: "finish", transitions: ["TR-1"] },
      { reqTrigger: "waived-trigger", transitions: [], waived: { reason: "not refined yet" } },
    ],
    unmapped: [
      { target: "R.orphan", reason: "derived downstream" },
      { target: "R.waived", reason: "" },
      { target: "OB-9", reason: "future work" },
    ],
  });

  test("statuses classify checkable / waived / capability / gap, and gaps become findings", () => {
    const plan = UnitRefinementPlan.of(designUnit, unitMap, req, "construction/x/map.md");
    expect(plan.statusOfObligation("OB-1")).toEqual({ kind: "checkable" });
    expect(plan.statusOfObligation("OB-2")).toEqual({ kind: "checkable" });
    expect(plan.mappedTransitionsOf("OB-2").map((t) => t.asString())).toEqual(["TR-1"]);
    expect(plan.statusOfObligation("OB-3")).toEqual({ kind: "capability", detail: "temporal refinement is outside v1 scope" });
    expect(plan.statusOfObligation("OB-4")).toEqual({ kind: "waived", reason: "depends on unmapped attribute(s) R.orphan" });
    expect(plan.statusOfObligation("OB-5")?.kind).toBe("gap");
    expect(plan.statusOfObligation("OB-6")).toEqual({ kind: "capability", detail: 'nature "mystery" has no refinement check' });
    expect(plan.statusOfScenario("SC-1")).toEqual({ kind: "checkable" });
    expect(plan.statusOfScenario("SC-2")).toEqual({ kind: "waived", reason: "binds unmapped attribute(s) R.orphan" });
    expect(plan.statusOfScenario("SC-3")).toEqual({ kind: "capability", detail: "event scenarios are not replayed in v1" });
    expect(plan.statusOfScenario("SC-4")).toEqual({ kind: "waived", reason: "binds unmapped attribute(s) R.waived" });
    const gapDetails = plan.gaps().toArray().map((g) => g.detail);
    expect(gapDetails.some((d) => d.includes('requirements event trigger "ghost" has no eventMap entry'))).toBe(true);
    expect(plan.gaps().toArray().every((g) => g.kind === "mapping-gap" && g.unit === "u1")).toBe(true);
    expect(plan.gaps().toArray()[0]?.witness).toEqual({ refs: [{ artifact: "construction/x/map.md", element: "units[u1]" }] });
  });

  test("map defects each produce their frozen gap wording", () => {
    const badMap: RefinementUnitMap = refUnitMap({
      attrMap: [
        exprMapping("R.flag", "D.flag"),
        exprMapping("R.flag", "D.flag"), // 重複
        exprMapping("R.ghost", "D.flag"), // 要件に無い
        enumMapping("R.flag2", "D.missing", {}), // from が設計に無い
        enumMapping("R.notenum", "D.phase", { draft: "x", done: "y" }), // 要件属性が enum でない＋値域外
        enumMapping("R.state", "D.flag", {}), // from が enum でない
        enumMapping("R.state2", "D.phase", { draft: "open" }), // 非全域
        { kind: "expression", req: "R.flag3", expr: { op: "ref", path: "D.nope" } },
      ],
      eventMap: [{ reqTrigger: "finish", transitions: ["TR-404"] }],
      unmapped: [],
    });
    const reqLocal = requirements({
      attributes: [
        { path: "R.flag", kind: "bool" },
        { path: "R.flag2", kind: "enum", values: ["a"] },
        { path: "R.notenum", kind: "bool" },
        { path: "R.silent", kind: "bool" },
        { path: "R.state", kind: "enum", values: ["open", "closed"] },
        { path: "R.state2", kind: "enum", values: ["open"] },
        { path: "R.flag3", kind: "bool" },
      ],
      obligations: [
        { id: "OB-2", nature: "event", frRefs: [], trigger: "finish", guard: { op: "ref", path: "R.flag" }, effect: { op: "eq", args: [{ op: "ref", path: "R.flag", prime: true }, { op: "bool", value: true }] } },
      ],
    });
    const plan = UnitRefinementPlan.of(designUnit, badMap, reqLocal, "m.md");
    const details = plan.gaps().toArray().map((g) => g.detail).join("\n");
    expect(details).toContain('attrMap maps "R.flag" more than once');
    expect(details).toContain('attrMap entry "R.ghost" names no attribute of the requirements IR');
    expect(details).toContain('enumMap.from "D.missing" is not a design attribute of unit u1');
    expect(details).toContain('attrMap entry "R.notenum" uses enumMap but the requirements attribute is bool');
    expect(details).toContain(`enumMap for "R.notenum" produces value(s) x, y outside`);
    expect(details).toContain('enumMap.from "D.flag" is not an enum design attribute');
    expect(details).toContain('enumMap for "R.state2" is not total over "D.phase": missing case(s) done');
    expect(details).toContain('attrMap expression for "R.flag3" references "D.nope"');
    expect(details).toContain('eventMap for "finish" names unknown design id(s) TR-404');
    expect(details).toContain("silence is a contract violation");
  });

  test("declaredEnumValuesOf distinguishes missing/non-enum (null) from declared values", () => {
    expect(designUnit.declaredEnumValuesOf("D.phase")).toEqual(["draft", "done"]);
    expect(designUnit.declaredEnumValuesOf("D.flag")).toBe(null);
    expect(designUnit.declaredEnumValuesOf("D.missing")).toBe(null);
  });

  test("status skips differ by backend flavor (frozen wordings)", () => {
    const plan = UnitRefinementPlan.of(designUnit, unitMap, req, "m.md");
    const smtSkips = plan.smtStatusSkips("u1").toArray().map((s) => `${s.target}:${s.reason}`);
    expect(smtSkips).toContain("OB-3:capability");
    expect(smtSkips).toContain("OB-4:waived");
    expect(smtSkips).not.toContain("OB-2:capability");
    const quintSkips = plan.quintStatusSkips(req, "u1").toArray();
    expect(quintSkips.find((s) => s.target === "OB-2")?.detail)
      .toBe("event simulation and enabledness are checked by the SMT refinement pass only in v1");
    expect(quintSkips.find((s) => s.target === "SC-1")?.detail)
      .toBe("scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)");
  });

  test("quint extras carry alpha(P) for checkable invariants only", () => {
    const plan = UnitRefinementPlan.of(designUnit, unitMap, req, "m.md");
    const extras = plan.quintInvariants(req);
    expect(extras.toArray().map((e) => e.reqId.asString())).toEqual(["OB-1"]);
    expect(extras.toArray()[0]?.expr).toEqual({ op: "ref", path: "D.flag" });
  });
});

describe("event catalog and effect assignments", () => {
  test("transitions get the implicit guard/effect, extra effects merge, event obligations join", () => {
    const u = unit({
      machines: [
        {
          id: "SM-1",
          entity: "D",
          attribute: "s",
          initial: [],
          deterministic: true,
          ignores: [],
          transitions: [
            {
              id: "TR-1",
              from: "a",
              to: "b",
              trigger: "go",
              brRefs: [],
              guard: { op: "bool", value: true },
              effect: { op: "eq", args: [{ op: "ref", path: "D.n", prime: true }, { op: "int", value: 1 }] },
            },
            { id: "TR-2", from: "a", to: "b", trigger: "go", brRefs: [], effect: { op: "bool", value: true } },
          ],
        },
      ],
      obligations: [
        { id: "DOB-1", nature: "event", origin: "", brRefs: [], frRefs: [], guard: { op: "bool", value: true }, effect: { op: "eq", args: [{ op: "ref", path: "D.n", prime: true }, { op: "int", value: 2 }] } },
        { id: "DOB-2", nature: "event", origin: "", brRefs: [], frRefs: [], guard: { op: "bool", value: true }, effect: { op: "bool", value: true } },
        { id: "DOB-3", nature: "invariant", origin: "", brRefs: [], frRefs: [] },
      ],
    });
    const catalog = DesignEventCatalog.of(u);
    expect(catalog.eventOf("TR-1")?.guard.op).toBe("and");
    expect(catalog.eventOf("TR-1")?.effectAssign.rhsOf("D.s")).toEqual({ op: "enum", value: "b" });
    expect(catalog.eventOf("TR-1")?.effectAssign.rhsOf("D.n")).toEqual({ op: "int", value: 1 });
    // 分解不能な追加効果は暗黙代入だけが残る（設計パスが報告する）。
    expect(catalog.eventOf("TR-2")?.effectAssign.count()).toBe(1);
    expect(catalog.eventOf("DOB-1")?.effectAssign.rhsOf("D.n")).toEqual({ op: "int", value: 2 });
    // 分解不能な event 義務はカタログに載らない。
    expect(catalog.eventOf("DOB-2")).toBe(null);
    expect(catalog.eventOf("DOB-3")).toBe(null);

    expect(() => EffectAssignments.ofEffect({ op: "or", args: [] })).toThrow("requirements effect is not a conjunction of primed assignments");
    expect(() => EffectAssignments.ofEffect({ op: "eq", args: [{ op: "ref", path: "x" }, { op: "int", value: 1 }] })).toThrow(AlphaError);
  });
});

describe("refinement verdict interpretation", () => {
  // plan と interpret に同一の requirements を渡す（本番経路と同じ整合）。
  const req = requirements({
    attributes: [{ path: "R.flag", kind: "bool" }],
    obligations: [
      { id: "OB-1", nature: "invariant", frRefs: ["FR-2", "FR-1"], assert: { op: "bool", value: true } },
      { id: "OB-2", nature: "event", frRefs: [], trigger: "go", guard: { op: "ref", path: "R.flag" }, effect: { op: "eq", args: [{ op: "ref", path: "R.flag", prime: true }, { op: "bool", value: true }] } },
    ],
    scenarios: [
      { id: "SC-1", kind: "accept", frRefs: ["FR-3"], bindings: {} },
      { id: "SC-2", kind: "reject", frRefs: [], bindings: {} },
    ],
  });
  // mappedTransitionsOf("OB-2") が ["TR-1", "TR-2"] になる実 plan を組む
  // （露出 Map スタブは plan のクラス化で死亡）。
  const planUnit = unit({
    attrPaths: new Set(["D.flag"]),
    machines: [
      {
        id: "SM-1",
        entity: "D",
        attribute: "s",
        initial: [],
        deterministic: true,
        ignores: [],
        transitions: [
          { id: "TR-1", from: "a", to: "b", trigger: "go", brRefs: [] },
          { id: "TR-2", from: "a", to: "b", trigger: "go", brRefs: [] },
        ],
      },
    ],
  });
  const plan = UnitRefinementPlan.of(
    planUnit,
    refUnitMap({ attrMap: [exprMapping("R.flag", "D.flag")], eventMap: [{ reqTrigger: "go", transitions: ["TR-1", "TR-2"] }] }),
    req,
    "m.md",
  );
  const facts = (entries: [string, RefinementProbe][]): RefinementSolverFacts =>
    RefinementSolverFacts.of({ pending: new Map(entries), compileSkips: DesignSkips.of([]) });
  const run = (f: RefinementSolverFacts, results: [string, Parameters<typeof RefinementQueryVerdict.reconstitute>[0]][]) =>
    f.interpret(RefinementQueryVerdicts.of(new Map(results.map(([id, v]) => [id, RefinementQueryVerdict.reconstitute(v)]))), req, plan, "u1");

  test("each probe kind emits its frozen finding on the deciding verdict", () => {
    const out = run(
      facts([
        ["rv:OB-1", { kind: "invariant", reqId: ObligationId.reconstitute("OB-1") }],
        ["rs:SC-1", { kind: "scenario", reqId: ScenarioId.reconstitute("SC-1") }],
        ["rs:SC-2", { kind: "scenario", reqId: ScenarioId.reconstitute("SC-2") }],
        ["re:OB-2", { kind: "enabledness", reqId: ObligationId.reconstitute("OB-2") }],
        ["rs2:OB-2:TR-1", { kind: "simulation", reqId: ObligationId.reconstitute("OB-2"), designId: TransitionRef.reconstitute("TR-1") }],
      ]),
      [
        ["rv:OB-1", { status: "sat", decodedModel: { "D.flag": true } }],
        ["rs:SC-1", { status: "unsat", core: ["inv_b", "inv_a"] }],
        ["rs:SC-2", { status: "sat", decodedModel: { "D.flag": false } }],
        ["re:OB-2", { status: "sat", decodedModel: { "D.s": "a" } }],
        ["rs2:OB-2:TR-1", { status: "sat", decodedModel: { "D.s": "a" }, decodedPostModel: { "D.s": "b" } }],
      ],
    );
    expect(out.findings.toArray().map((f) => `${f.kind}:${f.targets.joined(",")}`)).toEqual([
      "refinement-violation:OB-1",
      "refinement-violation:SC-1",
      "refinement-violation:SC-2",
      "completeness-gap:OB-2,TR-1,TR-2",
      "refinement-violation:OB-2,TR-1",
    ]);
    expect(out.findings.toArray()[0]?.frRefs.toArray()).toEqual(["FR-1", "FR-2"]);
    expect(out.findings.toArray()[1]?.witness).toEqual({ core: ["inv_a", "inv_b"] });
    expect(out.findings.toArray()[4]?.witness).toEqual({ trace: [{ "D.s": "a" }, { "D.s": "b" }] });
    expect(out.findings.toArray()[0]?.detail).toContain("The design admits what the verified requirements forbid.");
    expect(out.findings.toArray()[4]?.detail).toContain("produces an abstract post-state that violates the requirements effect or the abstract frame");
  });

  test("quiet verdicts emit nothing; undecided and missing become the frozen timeout skip", () => {
    const out = run(
      facts([
        ["rv:OB-1", { kind: "invariant", reqId: ObligationId.reconstitute("OB-1") }],
        ["rs:SC-1", { kind: "scenario", reqId: ScenarioId.reconstitute("SC-1") }],
        ["rs:SC-2", { kind: "scenario", reqId: ScenarioId.reconstitute("SC-2") }],
        ["re:OB-2", { kind: "enabledness", reqId: ObligationId.reconstitute("OB-2") }],
        ["rs2:OB-2:TR-1", { kind: "simulation", reqId: ObligationId.reconstitute("OB-2"), designId: TransitionRef.reconstitute("TR-1") }],
        ["rv:OB-9", { kind: "invariant", reqId: ObligationId.reconstitute("OB-9") }],
      ]),
      [
        ["rv:OB-1", { status: "unsat" }],
        ["rs:SC-1", { status: "sat" }],
        ["rs:SC-2", { status: "unsat" }],
        ["re:OB-2", { status: "unsat" }],
        ["rs2:OB-2:TR-1", { status: "unknown" }],
      ],
    );
    expect(out.findings.toArray()).toEqual([]);
    expect(out.skipped.toArray().map((s) => `${s.target}:${s.reason}`)).toEqual(["OB-2:timeout", "OB-9:timeout"]);
    expect(out.skipped.toArray()[0]?.detail).toBe("refinement query rs2:OB-2:TR-1 exceeded the solver budget or errored");
  });
});

describe("refinement collections (first-class operations)", () => {
  test("of/add/iterator/toArray and the map-side set knowledge", () => {
    const am = AttributeMappings.of([]).add(wrapMapping(exprMapping("R.a", "D.a")));
    expect([...am].length).toBe(1);
    expect(am.toArray()[0]?.req.asString()).toBe("R.a");

    const tref = (raw: string): TransitionRef => TransitionRef.reconstitute(raw);
    const tr = TransitionRefs.of([tref("TR-2")]).add(tref("TR-10"));
    expect([...tr].map((t) => t.asString())).toEqual(["TR-2", "TR-10"]);
    expect(tr.isEmpty()).toBe(false);
    expect(TransitionRefs.of([]).isEmpty()).toBe(true);
    expect(tr.unknownAmong(new Set(["TR-2"]))).toEqual(["TR-10"]);
    // unknownAmong は素の辞書順、sortedCanonically は IdOrder.compare（数値尾）。
    expect(tr.sortedCanonically().map((t) => t.asString())).toEqual(["TR-2", "TR-10"]);
    expect(tr.toArray().map((t) => t.asString())).toEqual(["TR-2", "TR-10"]);
    expect(tref("TR-1").equals(tref("TR-1"))).toBe(true);
    expect(TransitionRef.parse("").ok).toBe(false);

    const trig = (raw: string): TriggerName => TriggerName.reconstitute(raw);
    const em = EventMappings.of([]).add({ reqTrigger: trig("go"), transitions: TransitionRefs.of([tref("TR-1")]) })
      .add({ reqTrigger: trig("go"), transitions: TransitionRefs.of([tref("TR-9")]) });
    expect([...em].length).toBe(2);
    // 重複トリガは最後の宣言が勝つ（旧 new Map の凍結挙動）。
    expect([...(em.ofTrigger(trig("go"))?.transitions ?? TransitionRefs.of([]))].map((t) => t.asString())).toEqual(["TR-9"]);
    expect(em.ofTrigger(trig("ghost"))).toBe(undefined);
    expect(em.toArray().length).toBe(2);

    const uref = (raw: string): UnmappedTargetRef => UnmappedTargetRef.reconstitute(raw);
    const un = UnmappedDeclarations.of([{ target: uref("R.x"), reason: "first" }]).add({ target: uref("R.x"), reason: "last" });
    expect([...un].length).toBe(2);
    expect(un.covers("R.x")).toBe(true);
    expect(un.covers("R.y")).toBe(false);
    expect(un.coversAll(["R.x"])).toBe(true);
    expect(un.coversAll(["R.x", "R.y"])).toBe(false);
    // 理由の索引も最後の宣言が勝つ。
    expect(un.reasonOf("R.x")).toBe("last");
    expect(un.reasonOf("R.y")).toBe(undefined);
    expect(un.toArray().length).toBe(2);

    const m1 = refUnitMap({ unit: "u1" });
    const maps = RefinementUnitMaps.of([]).add(m1).add(refUnitMap({ unit: "u1", attrMap: [exprMapping("R.b", "D.b")] }));
    expect([...maps].length).toBe(2);
    // 重複ユニットは最初の宣言が勝つ（旧 find の凍結挙動）。
    expect(maps.mapOf(DesignUnitId.of("u1"))).toBe(m1);
    expect(maps.mapOf(DesignUnitId.of("zz"))).toBe(undefined);
    expect(maps.toArray().length).toBe(2);
  });

  test("requirements-view collections own their index knowledge", () => {
    const vals = ReqAttributeValues.of(["open"]).add("closed");
    expect([...vals]).toEqual(["open", "closed"]);
    expect(vals.includes("closed")).toBe(true);
    expect(vals.includes("ghost")).toBe(false);
    expect(vals.toArray()).toEqual(["open", "closed"]);

    const apath = (raw: string): AttributePath => AttributePath.reconstitute(raw);
    const attrs = RefinementAttributes.of([{ path: apath("R.b"), kind: "bool" }])
      .add({ path: apath("R.a"), kind: "int" })
      .add({ path: apath("R.a"), kind: "bool" });
    expect([...attrs].length).toBe(3);
    expect(attrs.covers("R.a")).toBe(true);
    expect(attrs.covers("R.z")).toBe(false);
    // path 索引は最後の宣言が勝つ。
    expect(attrs.byPath("R.a")?.kind).toBe("bool");
    expect(attrs.byPath("R.z")).toBe(undefined);
    expect(attrs.sortedByPath().toArray().map((a) => a.path.asString())).toEqual(["R.a", "R.a", "R.b"]);

    const rob = (id: string, nature: string) => RefinementObligation.reconstitute({ id: ObligationId.reconstitute(id), nature: ObligationNature.reconstitute(nature), frRefs: FrRefs.of([]) });
    const obs = RefinementObligations.of([rob("OB-2", "invariant")])
      .add(rob("OB-1", "event"))
      .add(rob("OB-1", "numeric"));
    expect([...obs].length).toBe(3);
    expect(obs.byId("OB-1")?.nature().asString()).toBe("numeric");
    expect(obs.byId("OB-9")).toBe(undefined);
    expect(obs.sortedCanonically().toArray().map((o) => o.id().asString())).toEqual(["OB-1", "OB-1", "OB-2"]);

    const rsc = (id: string, kind: "accept" | "reject") => RefinementScenario.reconstitute({ id: ScenarioId.reconstitute(id), kind, frRefs: FrRefs.of([]), bindings: {} });
    const scs = RefinementScenarios.of([rsc("SC-2", "accept")])
      .add(rsc("SC-1", "reject"))
      .add(rsc("SC-1", "accept"));
    expect([...scs].length).toBe(3);
    expect(scs.byId("SC-1")?.kind()).toBe("accept");
    expect(scs.byId("SC-9")).toBe(undefined);
    expect(scs.toArray().length).toBe(3);
  });

  test("quint invariant collection knows its req ids", () => {
    const inv = RefinementQuintInvariants.of([]).add({ reqId: ObligationId.reconstitute("OB-1"), frRefs: FrRefs.of([]), expr: { op: "bool", value: true } });
    expect(inv.isEmpty()).toBe(false);
    expect([...inv].length).toBe(1);
    expect([...inv.reqIds()]).toEqual(["OB-1"]);
    expect(inv.toArray()[0]?.reqId.asString()).toBe("OB-1");
  });
});

describe("catalog misses in the enabledness path (frozen null-drop)", () => {
  test("a mapped design id outside the catalog is silently dropped, not a compile-error", () => {
    // 宣言済みだがカタログに載らない設計 id（event でない義務）へ写像しても、
    // 旧 Map.get の undefined 落ちと同じく黙って除外される——義務全体が
    // compile-error skip に化けてはならない。
    const u = unit({
      attrPaths: new Set(["D.flag"]),
      rawEntities: [{ name: "D", attributes: [{ name: "flag", type: { kind: "bool" } }] }],
      obligations: [{ id: "DOB-9", nature: "invariant", origin: "", brRefs: [], frRefs: [] }],
    });
    const req = requirements({
      attributes: [{ path: "R.flag", kind: "bool" }],
      obligations: [
        { id: "OB-2", nature: "event", frRefs: [], trigger: "go", guard: { op: "ref", path: "R.flag" }, effect: { op: "eq", args: [{ op: "ref", path: "R.flag", prime: true }, { op: "bool", value: true }] } },
      ],
    });
    const plan = UnitRefinementPlan.of(
      u,
      refUnitMap({ attrMap: [exprMapping("R.flag", "D.flag")], eventMap: [{ reqTrigger: "go", transitions: ["DOB-9"] }] }),
      req,
      "m.md",
    );
    expect(plan.statusOfObligation("OB-2")).toEqual({ kind: "checkable" });
    const built = buildRefinementQueries(u, req, plan);
    const enabledness = built.queries.find((q) => q.id === "re:OB-2");
    expect(enabledness).toBeDefined();
    // 発火可能な設計ガードなし → notEnabled は "true"（黙った除外の凍結面）。
    expect(enabledness?.script).toContain("(assert (=> ne_OB_2 true))");
    expect(built.facts.compileSkips().toArray()).toEqual([]);
  });
});

describe("RefinementMaterials aggregate (repository ruling)", () => {
  test("carries its id, and the state predicates guard the active accessors", () => {
    const id = RefinementMaterialsId.ofModel(DesignModelId.of(ap("/r/m.md")));
    const inactive = RefinementMaterials.inactive(id);
    expect(inactive.id().equals(id)).toBe(true);
    expect(inactive.isActive()).toBe(false);
    expect(() => inactive.requirements()).toThrow("defect");
    expect(() => inactive.mapAcquisition()).toThrow("defect");
    const active = RefinementMaterials.active(id, requirements({}), { kind: "absent", error: null });
    expect(active.isActive()).toBe(true);
    expect(active.mapAcquisition().kind).toBe("absent");
    expect(active.requirements()).toBeDefined();
  });
});

describe("RefinementMapRepository (owner ruling: writable where writing is definable)", () => {
  test("findById parses via the shared contract-4 parser and store round-trips the document", () => {
    const mapDoc = readFileSync(join(fixtures, "record", "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-refinement-map.md"), "utf-8");
    const dir = mkdtempSync(join(tmpdir(), "refmap-repo-"));
    try {
      const path = join(dir, "deep-spec-analysis-refinement-map.md");
      writeFileSync(path, mapDoc);
      const repo = new RefinementMapRepositoryImpl(mapSchemaPath);
      const found = repo.findById(RefinementMapId.of(ap(path)));
      expect(found.ok).toBe(true);
      if (!found.ok) return;
      expect(Buffer.from(found.value.sourceDocument()).toString("utf-8")).toBe(mapDoc);
      expect(found.value.units().toArray().length).toBeGreaterThan(0);
      rmSync(path);
      expect(repo.store(found.value).ok).toBe(true);
      expect(readFileSync(path, "utf-8")).toBe(mapDoc);
      // 不在は not-found、壊れた文書は composite と同一の凍結文言で corrupt。
      const missing = repo.findById(RefinementMapId.of(ap(join(dir, "nowhere.md"))));
      expect(!missing.ok && missing.error.kind).toBe("not-found");
      writeFileSync(path, "no fence here\n");
      const corrupt = repo.findById(RefinementMapId.of(ap(path)));
      expect(!corrupt.ok && corrupt.error.kind === "corrupt" && corrupt.error.cause).toBe("refinement map does not contain exactly one ```json fence");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("split-file coverage pins (one-public-type refactor)", () => {
  test("solver facts expose compile skips and issue-order iteration; unmapped target parses", () => {
    const f = RefinementSolverFacts.of({
      pending: new Map<string, RefinementProbe>([
        ["rv:OB-9", { kind: "invariant", reqId: ObligationId.reconstitute("OB-9") }],
      ]),
      compileSkips: DesignSkips.of([]),
    });
    expect([...f].map(([id]) => id)).toEqual(["rv:OB-9"]);
    expect(f.compileSkips().toArray()).toEqual([]);
    const parsed = UnmappedTargetRef.parse("OB-1");
    expect(parsed.ok && parsed.value.equals(UnmappedTargetRef.reconstitute("OB-1"))).toBe(true);
    expect(UnmappedTargetRef.parse("").ok).toBe(false);
  });
});

describe("thaw pins — quint alpha skips, timeout break, exact decode (#34/#38)", () => {
  const designUnit = () =>
    unit({ rawEntities: [{ name: "D", attributes: [{ name: "flag", type: { kind: "bool" } }] }] });
  const reqOneInvariant = () =>
    requirements({
      attributes: [{ path: "R.flag", kind: "bool" }],
      obligations: [{ id: "OB-1", nature: "invariant", frRefs: ["FR-1"], assert: { op: "ref", path: "R.flag" } }],
    });

  test("alpha failures reach the quint document as compile-error skips, wording lockstep with the SMT pass", () => {
    const u = designUnit();
    const req = reqOneInvariant();
    const plan = UnitRefinementPlan.of(u, refUnitMap({ attrMap: [{ kind: "unspecified", req: "R.flag" }] }), req, "m.md");
    const quint = plan.quintStatusSkips(req, "u1").toArray().filter((s) => s.reason === "compile-error");
    expect(quint).toEqual([{
      target: "OB-1",
      reason: "compile-error",
      unit: "u1",
      detail: 'alpha substitution failed: attrMap entry for "R.flag" declares neither an expression nor enum cases',
    }]);
    // SMT 側の compileSkips と逐語で対（凍結解除 #38 項 1 の対称性）。
    expect(buildRefinementQueries(u, req, plan).facts.compileSkips().toArray()).toEqual(quint);
  });

  test("a timed-out runtime is not retried on the fallback runtime (thaw #38 item 2)", () => {
    const u = designUnit();
    const req = reqOneInvariant();
    const plan = UnitRefinementPlan.of(u, refUnitMap({ attrMap: [exprMapping("R.flag", "D.flag")] }), req, "m.md");
    const host = join(mkdtempSync(join(tmpdir(), "sleepy-child-")), "sleepy.ts");
    writeFileSync(host, "setTimeout(() => process.exit(0), 30_000);\n");
    const started = Date.now();
    // budgetMs -14_800 → spawnSync timeout 200ms：眠る子は必ず ETIMEDOUT。
    const out = new RefinementSolverClientImpl({
      childHostPath: host,
      perQueryTimeoutMs: 100,
      runtimeOverride: undefined,
      workingDirectory: process.cwd(),
    }).check(u, req, plan, -14_800);
    expect(out.result.kind).toBe("unavailable");
    const reason = out.result.kind === "unavailable" ? out.result.reason : "";
    expect(reason).toContain("node:");
    expect(reason).toContain("ETIMEDOUT");
    expect(reason).not.toContain("bun:");
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  test("model values beyond the safe range decode to exact decimal strings (thaw #34 item 4)", () => {
    const attr = { path: "o.n", kind: "int" as const };
    const ctx: RefinementSmtContext = { attrs: [attr], byPath: new Map([["o.n", attr]]) };
    expect(decodeDesignModel(ctx, { v_o_n: "10000000000000000000021" }, false)).toEqual({ "o.n": "10000000000000000000021" });
    expect(decodeDesignModel(ctx, { v_o_n: "(- 10000000000000000000021)" }, false)).toEqual({ "o.n": "-10000000000000000000021" });
    expect(decodeDesignModel(ctx, { v_o_n: "7" }, false)).toEqual({ "o.n": 7 });
  });
});
