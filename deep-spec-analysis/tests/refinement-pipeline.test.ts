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
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Json } from "../tools/kernel/adapter/index.ts";
import { SystemClock } from "../tools/kernel/adapter/index.ts";
import { ContentHash, ArtifactPath } from "../tools/kernel/domain/index.ts";
import { FormalModelId } from "../tools/requirements/domain/index.ts";
// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import {
  AttrPaths,
  DesignBackgroundAssumptions,
  DesignMachines,
  DesignObligations,
  DesignScenarios,
  type DesignBackgroundAssumption,
  type DesignMachine,
  type DesignObligation,
  type DesignScenario,
  type DesignValue, type DesignUnit as DesignUnitType, DesignModelId, DesignUnit, DesignUnitId, RefinementMaterialsId } from "../tools/design/domain/index.ts";
import {
  DesignModelRepositoryImpl,
  DesignReportRepositoryImpl,
  RefinementMaterialsRepositoryImpl,
  RefinementSolverClientImpl,
  SiblingBackendClientImpl,
  buildRefinementQueries,
} from "../tools/design/adapter/index.ts";
import { VerifyDesignQuintUseCase, VerifyDesignSmtUseCase } from "../tools/design/usecase/index.ts";
import {
  AlphaError,
  type RefinementQueryVerdict,
  type RefinementSolverFacts,
  RefinementRequirements,
  type RefinementRequirementsSeed,
  type RefinementUnitMap,
  alphaEquality,
  alphaExpr,
  designEnumValues,
  designEventCatalog,
  interpretRefinementVerdicts,
  planUnitRefinement,
  quintRefinementStatusSkips,
  refinementQuintInvariants,
  reqEffectAssignments,
  smtRefinementStatusSkips,
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
    const plan = buildSmtPlan(acquired.value.model);
    snapshot("v1-plan-queries.json", plan.queries as unknown as Json);
  });

  test("the second (refinement) compiler emits byte-identical scripts for the refinement fixture", () => {
    const modelPath = join(fixtures, "record", ...MODEL_RELPATH);
    const acquired = new DesignModelRepositoryImpl().findById(DesignModelId.of(ap(modelPath)));
    const context = new RefinementMaterialsRepositoryImpl(mapSchemaPath).findById(RefinementMaterialsId.ofModel(DesignModelId.of(ap(modelPath))));
    expect(acquired.ok && context.kind === "active" && context.map.kind === "loaded").toBe(true);
    if (!acquired.ok || context.kind !== "active" || context.map.kind !== "loaded") return;
    expect(context.map.map.units().length).toBeGreaterThan(0);
    expect(context.map.map.unitMapOf(DesignUnitId.of("no-such-unit"))).toBe(undefined);
    expect(context.map.map.id().artifactPath().asString().endsWith("deep-spec-analysis-refinement-map.md")).toBe(true);
    expect(context.requirements.id().artifactPath().asString().endsWith("deep-spec-analysis-formal-model.md")).toBe(true);
    const queries: Json[] = [];
    for (const u of acquired.value.model.units()) {
      const unitMap = context.map.map.unitMapOf(u.id());
      if (!unitMap) continue;
      const plan = planUnitRefinement(u, unitMap, context.requirements, context.map.mapArtifact);
      queries.push(...(buildRefinementQueries(u, context.requirements, plan).queries as unknown as Json[]));
    }
    snapshot("refinement-queries.json", queries as unknown as Json);
  });
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

function unit(seed: {
  unit?: string;
  rawEntities?: DesignValue;
  attrPaths?: Set<string>;
  obligations?: DesignObligation[];
  machines?: DesignMachine[];
  scenarios?: DesignScenario[];
  background?: DesignBackgroundAssumption[];
}): DesignUnitType {
  return DesignUnit.reconstitute({
    unit: seed.unit ?? "u1",
    rawEntities: seed.rawEntities ?? [],
    attrPaths: AttrPaths.of([...(seed.attrPaths ?? new Set<string>())]),
    obligations: DesignObligations.of(seed.obligations ?? []),
    machines: DesignMachines.of(seed.machines ?? []),
    scenarios: DesignScenarios.of(seed.scenarios ?? []),
    background: DesignBackgroundAssumptions.of(seed.background ?? []),
  });
}

function requirements(seed: Partial<RefinementRequirementsSeed>): RefinementRequirements {
  return RefinementRequirements.reconstitute({
    id: FormalModelId.of(ap("/test/deep-spec-analysis-formal-model.md")),
    hash: ContentHash.reconstitute("a".repeat(64)),
    attributes: [],
    obligations: [],
    scenarios: [],
    ...seed,
  });
}

const exprMapping = (req: string, path: string) =>
  ({ kind: "expression", req, expr: { op: "ref", path } }) as const;
const enumMapping = (req: string, from: string, cases: { [d: string]: string }) =>
  ({ kind: "enum-cases", req, from, cases }) as const;

describe("alpha substitution", () => {
  const ctx = {
    byReq: new Map<string, ReturnType<typeof exprMapping> | ReturnType<typeof enumMapping> | { kind: "unspecified"; req: string }>([
      ["R.flag", exprMapping("R.flag", "D.flag")],
      ["R.state", enumMapping("R.state", "D.phase", { draft: "open", review: "open", done: "closed" })],
      ["R.none", { kind: "unspecified", req: "R.none" }],
    ]),
    reqAttrByPath: new Map(),
  };

  test("enum eq expands to the disjunction of design values mapping to the literal", () => {
    const out = alphaExpr(ctx, { op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "open" }] }, false);
    expect(out).toEqual({
      op: "or",
      args: [
        { op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "draft" }] },
        { op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "review" }] },
      ],
    });
    const single = alphaExpr(ctx, { op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "closed" }] }, false);
    expect(single).toEqual({ op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "done" }] });
    const none = alphaExpr(ctx, { op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "ghost" }] }, false);
    expect(none).toEqual({ op: "bool", value: false });
    const ne = alphaExpr(ctx, { op: "ne", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "closed" }] }, false);
    expect(ne.op).toBe("not");
    const primed = alphaExpr(ctx, { op: "eq", args: [{ op: "ref", path: "R.state", prime: true }, { op: "enum", value: "closed" }] }, false);
    expect(primed).toEqual({ op: "eq", args: [{ op: "ref", path: "D.phase", prime: true }, { op: "enum", value: "done" }] });
  });

  test("expression mappings substitute (primed in post context) and errors are frozen", () => {
    expect(alphaExpr(ctx, { op: "ref", path: "R.flag" }, false)).toEqual({ op: "ref", path: "D.flag" });
    expect(alphaExpr(ctx, { op: "ref", path: "R.flag" }, true)).toEqual({ op: "ref", path: "D.flag", prime: true });
    expect(alphaExpr(ctx, { op: "and", args: [{ op: "ref", path: "R.flag" }, { op: "bool", value: true }] }, false).args?.[0]).toEqual({ op: "ref", path: "D.flag" });
    expect(() => alphaExpr(ctx, { op: "ref", path: "R.missing" }, false)).toThrow(AlphaError);
    expect(() => alphaExpr(ctx, { op: "ref", path: "R.state" }, false))
      .toThrow('enum-mapped requirements attribute "R.state" is only legal inside eq/ne against an enum literal');
    expect(() => alphaExpr(ctx, { op: "ref", path: "R.none" }, false))
      .toThrow('attrMap entry for "R.none" declares neither an expression nor enum cases');
  });

  test("alphaEquality builds frame equalities: expression eq, enum class-iff, null for unmapped/unspecified", () => {
    expect(alphaEquality(ctx, "R.flag")).toEqual({
      op: "eq",
      args: [{ op: "ref", path: "D.flag" }, { op: "ref", path: "D.flag", prime: true }],
    });
    const enumEq = alphaEquality(ctx, "R.state");
    expect(enumEq?.op).toBe("and");
    expect(enumEq?.args?.length).toBe(2); // closed / open の 2 類
    expect(alphaEquality(ctx, "R.missing")).toBe(null);
    expect(alphaEquality(ctx, "R.none")).toBe(null);
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
  const unitMap: RefinementUnitMap = {
    unit: "u1",
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
  };

  test("statuses classify checkable / waived / capability / gap, and gaps become findings", () => {
    const plan = planUnitRefinement(designUnit, unitMap, req, "construction/x/map.md");
    expect(plan.obligationStatus.get("OB-1")).toEqual({ kind: "checkable" });
    expect(plan.obligationStatus.get("OB-2")).toEqual({ kind: "checkable" });
    expect(plan.eventTransitions.get("OB-2")).toEqual(["TR-1"]);
    expect(plan.obligationStatus.get("OB-3")).toEqual({ kind: "capability", detail: "temporal refinement is outside v1 scope" });
    expect(plan.obligationStatus.get("OB-4")).toEqual({ kind: "waived", reason: "depends on unmapped attribute(s) R.orphan" });
    expect(plan.obligationStatus.get("OB-5")?.kind).toBe("gap");
    expect(plan.obligationStatus.get("OB-6")).toEqual({ kind: "capability", detail: 'nature "mystery" has no refinement check' });
    expect(plan.scenarioStatus.get("SC-1")).toEqual({ kind: "checkable" });
    expect(plan.scenarioStatus.get("SC-2")).toEqual({ kind: "waived", reason: "binds unmapped attribute(s) R.orphan" });
    expect(plan.scenarioStatus.get("SC-3")).toEqual({ kind: "capability", detail: "event scenarios are not replayed in v1" });
    expect(plan.scenarioStatus.get("SC-4")).toEqual({ kind: "waived", reason: "binds unmapped attribute(s) R.waived" });
    const gapDetails = plan.gaps.map((g) => g.detail);
    expect(gapDetails.some((d) => d.includes('requirements event trigger "ghost" has no eventMap entry'))).toBe(true);
    expect(plan.gaps.every((g) => g.kind === "mapping-gap" && g.unit === "u1")).toBe(true);
    expect(plan.gaps[0]?.witness).toEqual({ refs: [{ artifact: "construction/x/map.md", element: "units[u1]" }] });
  });

  test("map defects each produce their frozen gap wording", () => {
    const badMap: RefinementUnitMap = {
      unit: "u1",
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
    };
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
    const plan = planUnitRefinement(designUnit, badMap, reqLocal, "m.md");
    const details = plan.gaps.map((g) => g.detail).join("\n");
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

  test("designEnumValues distinguishes missing/non-enum (null) from declared values", () => {
    expect(designEnumValues(designUnit, "D.phase")).toEqual(["draft", "done"]);
    expect(designEnumValues(designUnit, "D.flag")).toBe(null);
    expect(designEnumValues(designUnit, "D.missing")).toBe(null);
  });

  test("status skips differ by backend flavor (frozen wordings)", () => {
    const plan = planUnitRefinement(designUnit, unitMap, req, "m.md");
    const smtSkips = smtRefinementStatusSkips(plan, "u1").map((s) => `${s.target}:${s.reason}`);
    expect(smtSkips).toContain("OB-3:capability");
    expect(smtSkips).toContain("OB-4:waived");
    expect(smtSkips).not.toContain("OB-2:capability");
    const quintSkips = quintRefinementStatusSkips(plan, req, "u1");
    expect(quintSkips.find((s) => s.target === "OB-2")?.detail)
      .toBe("event simulation and enabledness are checked by the SMT refinement pass only in v1");
    expect(quintSkips.find((s) => s.target === "SC-1")?.detail)
      .toBe("scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)");
  });

  test("quint extras carry alpha(P) for checkable invariants only", () => {
    const plan = planUnitRefinement(designUnit, unitMap, req, "m.md");
    const extras = refinementQuintInvariants(plan, req);
    expect(extras.map((e) => e.reqId)).toEqual(["OB-1"]);
    expect(extras[0]?.expr).toEqual({ op: "ref", path: "D.flag" });
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
    const catalog = designEventCatalog(u);
    expect(catalog.get("TR-1")?.guard.op).toBe("and");
    expect(catalog.get("TR-1")?.effectAssign.get("D.s")).toEqual({ op: "enum", value: "b" });
    expect(catalog.get("TR-1")?.effectAssign.get("D.n")).toEqual({ op: "int", value: 1 });
    // 分解不能な追加効果は暗黙代入だけが残る（設計パスが報告する）。
    expect(catalog.get("TR-2")?.effectAssign.size).toBe(1);
    expect(catalog.get("DOB-1")?.effectAssign.get("D.n")).toEqual({ op: "int", value: 2 });
    // 分解不能な event 義務はカタログに載らない。
    expect(catalog.has("DOB-2")).toBe(false);
    expect(catalog.has("DOB-3")).toBe(false);

    expect(() => reqEffectAssignments({ op: "or", args: [] })).toThrow("requirements effect is not a conjunction of primed assignments");
    expect(() => reqEffectAssignments({ op: "eq", args: [{ op: "ref", path: "x" }, { op: "int", value: 1 }] })).toThrow(AlphaError);
  });
});

describe("refinement verdict interpretation", () => {
  const req = requirements({
    obligations: [{ id: "OB-1", nature: "invariant", frRefs: ["FR-2", "FR-1"], assert: { op: "bool", value: true } }],
    scenarios: [
      { id: "SC-1", kind: "accept", frRefs: ["FR-3"], bindings: {} },
      { id: "SC-2", kind: "reject", frRefs: [], bindings: {} },
    ],
  });
  const plan = { ctx: { byReq: new Map(), reqAttrByPath: new Map() }, obligationStatus: new Map(), scenarioStatus: new Map(), eventTransitions: new Map([["OB-2", ["TR-1", "TR-2"]]]), gaps: [] };
  const facts = (entries: [string, { kind: "invariant" | "scenario" | "enabledness" | "simulation"; reqId: string; designId?: string }][]): RefinementSolverFacts => ({
    pending: new Map(entries),
    compileSkips: [],
  });
  const run = (f: RefinementSolverFacts, results: [string, RefinementQueryVerdict][]) =>
    interpretRefinementVerdicts("u1", req, plan, f, new Map(results));

  test("each probe kind emits its frozen finding on the deciding verdict", () => {
    const out = run(
      facts([
        ["rv:OB-1", { kind: "invariant", reqId: "OB-1" }],
        ["rs:SC-1", { kind: "scenario", reqId: "SC-1" }],
        ["rs:SC-2", { kind: "scenario", reqId: "SC-2" }],
        ["re:OB-2", { kind: "enabledness", reqId: "OB-2" }],
        ["rs2:OB-2:TR-1", { kind: "simulation", reqId: "OB-2", designId: "TR-1" }],
      ]),
      [
        ["rv:OB-1", { status: "sat", decodedModel: { "D.flag": true } }],
        ["rs:SC-1", { status: "unsat", core: ["inv_b", "inv_a"] }],
        ["rs:SC-2", { status: "sat", decodedModel: { "D.flag": false } }],
        ["re:OB-2", { status: "sat", decodedModel: { "D.s": "a" } }],
        ["rs2:OB-2:TR-1", { status: "sat", decodedModel: { "D.s": "a" }, decodedPostModel: { "D.s": "b" } }],
      ],
    );
    expect(out.findings.map((f) => `${f.kind}:${f.targets.join(",")}`)).toEqual([
      "refinement-violation:OB-1",
      "refinement-violation:SC-1",
      "refinement-violation:SC-2",
      "completeness-gap:OB-2,TR-1,TR-2",
      "refinement-violation:OB-2,TR-1",
    ]);
    expect(out.findings[0]?.frRefs).toEqual(["FR-1", "FR-2"]);
    expect(out.findings[1]?.witness).toEqual({ core: ["inv_a", "inv_b"] });
    expect(out.findings[4]?.witness).toEqual({ trace: [{ "D.s": "a" }, { "D.s": "b" }] });
    expect(out.findings[0]?.detail).toContain("The design admits what the verified requirements forbid.");
    expect(out.findings[4]?.detail).toContain("produces an abstract post-state that violates the requirements effect or the abstract frame");
  });

  test("quiet verdicts emit nothing; undecided and missing become the frozen timeout skip", () => {
    const out = run(
      facts([
        ["rv:OB-1", { kind: "invariant", reqId: "OB-1" }],
        ["rs:SC-1", { kind: "scenario", reqId: "SC-1" }],
        ["rs:SC-2", { kind: "scenario", reqId: "SC-2" }],
        ["re:OB-2", { kind: "enabledness", reqId: "OB-2" }],
        ["rs2:OB-2:TR-1", { kind: "simulation", reqId: "OB-2", designId: "TR-1" }],
        ["rv:OB-9", { kind: "invariant", reqId: "OB-9" }],
      ]),
      [
        ["rv:OB-1", { status: "unsat" }],
        ["rs:SC-1", { status: "sat" }],
        ["rs:SC-2", { status: "unsat" }],
        ["re:OB-2", { status: "unsat" }],
        ["rs2:OB-2:TR-1", { status: "unknown" }],
      ],
    );
    expect(out.findings).toEqual([]);
    expect(out.skipped.map((s) => `${s.target}:${s.reason}`)).toEqual(["OB-2:timeout", "OB-9:timeout"]);
    expect(out.skipped[0]?.detail).toBe("refinement query rs2:OB-2:TR-1 exceeded the solver budget or errored");
  });
});
