import { EnumerationMembers } from "@deep-spec/kernel-domain";
import { AttributeKind } from "@deep-spec/kernel-domain";
import { InitialState } from "@deep-spec/design-domain";
import { EnumerationMember } from "@deep-spec/kernel-domain";
import { scenarioBindings } from "./binding-fixtures.ts";
import { RequirementIdentifier, TriggerName, FunctionalRequirementReferences, ContentHash, ArtifactPath, FindingsSchema, TargetIdentifier, KeyedIndex, QueryLabel, type Expression } from "@deep-spec/kernel-domain";
import { BusinessRuleReference, DesignBackgroundIdentifier, DesignAttributeName, DesignEntityName, DesignMachineIdentifier, DesignObligationIdentifier, DesignObligationNature, DesignObligationOrigin, DesignScenarioIdentifier, DesignTransitionIdentifier, DesignBackgroundAssumptions, DesignMachines, DesignObligations, DesignScenarios, DesignBackgroundAssumption, DesignMachine, DesignObligation, DesignScenario, DesignIgnore, DesignTransition, BusinessRuleReferences, DesignIgnores, DesignModelIdentifier, DesignSkips, DesignTransitions, DesignUnit, DesignUnitIdentifier, InitialStates, RefinementMaterialsIdentifier, LoweredIdentifier, DesignEntityDeclarations, DesignEntityDeclaration, DesignAttributeDeclarations, DesignAttributeDeclaration, type DesignUnit as DesignUnitType, RefinementMapDefect, AttributeMappings, DesignEventCatalog, EffectAssignments, EventMappings, RefinementAttributes, RefinementObligations, RefinementQueryVerdicts, RefinementQuintInvariants, RefinementUnitMaps, RefinementRequirements, RefinementScenarios, RefinementSolverPlan, TransitionReference, TransitionReferences, UnitRefinementPlan, UnmappedDeclarations, UnmappedTargetReference, AttributeMapping, EventMapping, RefinementAttribute, RefinementQuintInvariant, RefinementUnitMap, UnmappedTarget, RefinementObligation, RefinementProbe, RefinementQueryVerdict, RefinementScenario, RefinementMaterials, RefinementMapIdentifier, RefinementStatus, RefinementMapAcquisition } from "@deep-spec/design-domain";

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
import { Json } from "@deep-spec/kernel-infrastructure";
import { SystemClock, readContractSchema } from "@deep-spec/kernel-adapter";

import { AttributePath, FormalModelIdentifier, ObligationIdentifier, ObligationNature, ScenarioIdentifier } from "@deep-spec/requirements-domain";
// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import { DesignModelRepositoryImplementation, DesignVerifyDirectoryRepositoryImplementation, RefinementMaterialsRepositoryImplementation, RefinementSolverClientImplementation, SiblingBackendClientImplementation, buildRefinementQueries, decodeDesignModel, type RefinementSatisfiabilityModuloTheoriesContext, RefinementMapRepositoryImplementation, parseDesignEntities } from "@deep-spec/design-adapter";
import { VerifyDesignQuintUseCase, VerifyDesignSatisfiabilityModuloTheoriesUseCase } from "@deep-spec/design-usecase";

import { FormalModelRepositoryImplementation, buildSmtPlan } from "@deep-spec/requirements-adapter";

// 被覆状態は class（#71 波22）——期待値は公開の面（checkable / gap / skip）から平文へ射影して比較する。
const plainStatus = (st: RefinementStatus | undefined) => {
  if (st === undefined) return undefined;
  if (st.isCheckable()) return { kind: "checkable" };
  const gap = st.gapDetail();
  if (gap !== null) return { kind: "gap", detail: gap };
  const skip = st.skipFor(TargetIdentifier.of("OB-999"), "u");
  return skip === null ? undefined : skip.reason() === "waived" ? { kind: "waived", reason: skip.detail() } : { kind: "capability", detail: skip.detail() };
};

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
// スキーマ原本はソースツリー側（src/entries/data/）。toolsDir は生成される配布物の
// spawn 先で、原本の置き場ではない。
const dataDir = join(pluginRoot, "src", "entries", "data");
const fixtures = join(pluginRoot, "tests", "fixtures", "refinement");
const findingsSchemaPath = join(dataDir, "deep-spec-findings-schema.json");
const mapSchemaPath = join(dataDir, "deep-spec-refinement-map-schema.json");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");
const MODEL_RELPATH = ["construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"];

function golden(file: string): string {
  return readFileSync(join(fixtures, "expected", file), "utf-8");
}

function wiring(record: string) {
  const modelPath = join(record, ...MODEL_RELPATH);
  const verifyDir = join(dirname(modelPath), "deep-spec-design-verify");
  const reports = new DesignVerifyDirectoryRepositoryImplementation();
  const schema = readContractSchema(findingsSchemaPath);
  const findingsSchema = schema.ok ? FindingsSchema.of(schema.value) : FindingsSchema.unreadable(schema.error.cause);
  const sibling = new SiblingBackendClientImplementation({
    siblingToolPaths: {
      smt: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
      quint: join(toolsDir, "aidlc-sensor-deep-spec-verify-quint.ts"),
    },
    workingDirectory: pluginRoot,
    spawnEnvironment: { ...process.env, AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation", AIDLC_DEEP_SPEC_QUINT_BIN: quintBin },
  });
  const contexts = new RefinementMaterialsRepositoryImplementation(mapSchemaPath);
  const solver = new RefinementSolverClientImplementation({
    childHostPath: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
    perQueryTimeoutMs: 2000,
    runtimeOverride: undefined,
    workingDirectory: pluginRoot,
  });
  return { modelPath, verifyDir, reports, findingsSchema, sibling, contexts, solver };
}

describe("in-process golden equivalence (both interactors, phase 3 included)", () => {
  test("smt + quint + converged cross-check reproduce the refinement golden bytes", () => {
    const record = mkdtempSync(join(tmpdir(), "refinement-usecase-"));
    try {
      cpSync(join(fixtures, "record"), record, { recursive: true });
      const w = wiring(record);
      const smt = new VerifyDesignSatisfiabilityModuloTheoriesUseCase(
        new DesignModelRepositoryImplementation(),
        w.reports,
        w.findingsSchema,
        w.sibling,
        w.contexts,
        w.solver,
        new SystemClock(),
      ).execute({ modelId: DesignModelIdentifier.of(ap(w.modelPath)), verifyDirectory: ap(w.verifyDir) });
      expect(smt.kind).toBe("verified");
      expect(readFileSync(join(w.verifyDir, "smt.json"), "utf-8")).toBe(golden("smt.json"));

      const quint = new VerifyDesignQuintUseCase(
        new DesignModelRepositoryImplementation(),
        w.reports,
        w.findingsSchema,
        w.sibling,
        w.contexts,
        new SystemClock(),
        2,
      ).execute({ modelId: DesignModelIdentifier.of(ap(w.modelPath)), verifyDirectory: ap(w.verifyDir) });
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
    const acquired = new FormalModelRepositoryImplementation().findById(
      FormalModelIdentifier.of(ap(join(pluginRoot, "tests", "fixtures", "conformance", "deep-spec-analysis-formal-model.md"))),
    );
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const plan = buildSmtPlan(acquired.value);
    snapshot("v1-plan-queries.json", plan.queries as unknown as Json);
  });

  test("the second (refinement) compiler emits byte-identical scripts for the refinement fixture", () => {
    const modelPath = join(fixtures, "record", ...MODEL_RELPATH);
    const acquired = new DesignModelRepositoryImplementation().findById(DesignModelIdentifier.of(ap(modelPath)));
    const materials = new RefinementMaterialsRepositoryImplementation(mapSchemaPath).findById(RefinementMaterialsIdentifier.of(DesignModelIdentifier.of(ap(modelPath))));
    expect(acquired.ok && materials.ok && materials.value.isActive()).toBe(true);
    if (!acquired.ok || !materials.ok || !materials.value.isActive()) return;
    const context = materials.value;
    const acq = context.mapAcquisition();
    const req = context.requirements();
    expect(req.id().artifactPath().asString().endsWith("deep-spec-analysis-formal-model.md")).toBe(true);
    const queries: Json[] = [];
    acq.match({
      absent: (error) => {
        throw new Error(`expected a loaded refinement map: ${error}`);
      },
      loaded: (map, mapArtifact) => {
        expect(map.units().toArray().length).toBeGreaterThan(0);
        expect(map.unitMapOf(DesignUnitIdentifier.of("no-such-unit"))).toBe(undefined);
        expect(map.id().artifactPath().asString().endsWith("deep-spec-analysis-refinement-map.md")).toBe(true);
        expect(mapArtifact.asString().endsWith("deep-spec-analysis-refinement-map.md")).toBe(true);
        for (const u of acquired.value.units()) {
          const unitMap = map.unitMapOf(u.id());
          if (!unitMap) continue;
          const plan = UnitRefinementPlan.of(u, unitMap, req, mapArtifact);
          queries.push(...(buildRefinementQueries(u, req, plan).queries as unknown as Json[]));
        }
      },
    });
    snapshot("refinement-queries.json", queries as unknown as Json);
  });
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

// テストの読みやすさのため素の配列・素の文字列で書き、ここで一括して DP と
// コレクションに包む。
type RawDesignObligation = Omit<Parameters<typeof DesignObligation.of>[0], "id" | "nature" | "origin" | "businessRuleReferences" | "functionalRequirementReferences"> & {
  id: string;
  nature: string;
  origin: string;
  brRefs: string[];
  frRefs: string[];
};
type RawDesignTransition = Omit<Parameters<typeof DesignTransition.of>[0], "id" | "businessRuleReferences" | "trigger"> & { id: string; brRefs: string[]; trigger: string };
// reason は design IR 上の必須注記（文書には残るが domain は運ばない——#71 波9）。
type RawDesignIgnore = Omit<Parameters<typeof DesignIgnore.of>[0], "trigger"> & { trigger: string; reason: string };
type RawDesignMachine = Omit<Parameters<typeof DesignMachine.of>[0], "id" | "entity" | "attribute" | "initial" | "transitions" | "ignores"> & {
  id: string;
  entity: string;
  attribute: string;
  initial: string[];
  transitions: RawDesignTransition[];
  ignores: RawDesignIgnore[];
};
type RawDesignScenario = Omit<Parameters<typeof DesignScenario.of>[0], "id" | "businessRuleReferences" | "functionalRequirementReferences"> & { id: string; brRefs: string[]; frRefs: string[] };

// テスト用: 生の entities JSON と属性座標から型付き実体宣言を組む（裁定 2 で
// DesignUnit は生 JSON を持たなくなった）。座標だけ与えられた属性は kind "" の
// 宣言として補う——旧 attrPaths の役目。
function entitiesOf(raw: Json[], attrPaths: Set<string>): DesignEntityDeclarations {
  const parsed = parseDesignEntities({ entities: raw });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  let declared = parsed.value;
  const covered = new Set<string>();
  for (const ent of declared) for (const attr of ent.attributes()) covered.add(`${ent.name().asString()}.${attr.name().asString()}`);
  const extra = new Map<string, string[]>();
  for (const path of attrPaths) {
    if (covered.has(path)) continue;
    const dot = path.indexOf(".");
    extra.set(path.slice(0, dot), [...(extra.get(path.slice(0, dot)) ?? []), path.slice(dot + 1)]);
  }
  for (const [entity, attrs] of extra) {
    declared = declared.add(DesignEntityDeclaration.of({
      name: DesignEntityName.of(entity),
      attributes: DesignAttributeDeclarations.of(attrs.map((a) => DesignAttributeDeclaration.of({ name: DesignAttributeName.of(a), kind: AttributeKind.of("") }))),
    }));
  }
  return declared;
}

function unit(seed: {
  unit?: string;
  rawEntities?: Json[];
  attrPaths?: Set<string>;
  obligations?: RawDesignObligation[];
  machines?: RawDesignMachine[];
  scenarios?: RawDesignScenario[];
  background?: { id: string; assert: Expression }[];
}): DesignUnitType {
  return DesignUnit.of({
    unit: seed.unit ?? "u1",
    entities: entitiesOf(seed.rawEntities ?? [], seed.attrPaths ?? new Set<string>()),
    obligations: DesignObligations.of(
      (seed.obligations ?? []).map((o) => DesignObligation.of({
        ...o,
        id: DesignObligationIdentifier.of(o.id),
        nature: DesignObligationNature.of(o.nature),
        origin: DesignObligationOrigin.of(o.origin),
        businessRuleReferences: BusinessRuleReferences.of(Array.from(o.brRefs, (raw) => BusinessRuleReference.of(raw))),
        functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(o.frRefs, (raw) => RequirementIdentifier.of(raw))),
      })),
    ),
    machines: DesignMachines.of(
      (seed.machines ?? []).map((m) =>
        DesignMachine.of({
          ...m,
          id: DesignMachineIdentifier.of(m.id),
          entity: DesignEntityName.of(m.entity),
          attribute: DesignAttributeName.of(m.attribute),
          initial: InitialStates.of((m.initial).map((value) => InitialState.of(value))),
          transitions: DesignTransitions.of(
            m.transitions.map((t) => DesignTransition.of({ ...t, id: DesignTransitionIdentifier.of(t.id), businessRuleReferences: BusinessRuleReferences.of(Array.from(t.brRefs, (raw) => BusinessRuleReference.of(raw))), trigger: TriggerName.of(t.trigger) })),
          ),
          ignores: DesignIgnores.of(m.ignores.map((g) => DesignIgnore.of({ ...g, trigger: TriggerName.of(g.trigger) }))),
        }),
      ),
    ),
    scenarios: DesignScenarios.of(
      (seed.scenarios ?? []).map((s) => DesignScenario.of({ ...s, id: DesignScenarioIdentifier.of(s.id), businessRuleReferences: BusinessRuleReferences.of(Array.from(s.brRefs, (raw) => BusinessRuleReference.of(raw))), functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(s.frRefs, (raw) => RequirementIdentifier.of(raw))) })),
    ),
    background: DesignBackgroundAssumptions.of(
      (seed.background ?? []).map((b) => DesignBackgroundAssumption.of({ ...b, id: DesignBackgroundIdentifier.of(b.id) })),
    ),
  });
}

// テストの読みやすさのため素の配列・素の id で書き、ここで一括して DP と
// コレクションに包む（アダプタの門と同型）。
type RawRequirementAttribute = { path: string; kind: "bool" | "int" | "enum"; min?: number; max?: number; values?: string[] };
type RawRequirementObligation = Omit<Parameters<typeof RefinementObligation.of>[0], "id" | "nature" | "functionalRequirementReferences" | "trigger"> & { id: string; nature: string; frRefs: string[]; trigger?: string };
type RawRequirementScenario = Omit<Parameters<typeof RefinementScenario.of>[0], "id" | "functionalRequirementReferences" | "event"> & { id: string; frRefs: string[]; event?: { trigger: string } };
function requirements(seed: {
  attributes?: RawRequirementAttribute[];
  obligations?: RawRequirementObligation[];
  scenarios?: RawRequirementScenario[];
}): RefinementRequirements {
  return RefinementRequirements.of({
    id: FormalModelIdentifier.of(ap("/test/deep-spec-analysis-formal-model.md")),
    hash: ContentHash.of("a".repeat(64)),
    attributes: RefinementAttributes.of(
      (seed.attributes ?? []).map((a) => RefinementAttribute.of({
        path: AttributePath.of(a.path),
        kind: a.kind,
        values: a.values === undefined ? undefined : EnumerationMembers.of((a.values).map((value) => EnumerationMember.of(value))),
      })),
    ),
    obligations: RefinementObligations.of(
      (seed.obligations ?? []).map((o) => RefinementObligation.of({
        ...o,
        id: ObligationIdentifier.of(o.id),
        nature: ObligationNature.of(o.nature),
        functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(o.frRefs, (raw) => RequirementIdentifier.of(raw))),
        trigger: o.trigger === undefined ? undefined : TriggerName.of(o.trigger),
      })),
    ),
    scenarios: RefinementScenarios.of(
      (seed.scenarios ?? []).map((s) => RefinementScenario.of({
        ...s,
        id: ScenarioIdentifier.of(s.id),
        functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(s.frRefs, (raw) => RequirementIdentifier.of(raw))),
        event: s.event === undefined ? undefined : { trigger: TriggerName.of(s.event.trigger) },
      })),
    ),
  });
}

type RawAttributeMapping =
  | { kind: "expression"; req: string; expr: Expression }
  | { kind: "enum-cases"; req: string; from: string; cases: { [designValue: string]: string } }
  | { kind: "unspecified"; req: string };
type RawEventMapping = { reqTrigger: string; transitions: string[]; waived?: { reason: string } };
type RawUnmappedTarget = { target: string; reason: string };
function wrapMapping(m: RawAttributeMapping): AttributeMapping {
  const req = AttributePath.of(m.req);
  switch (m.kind) {
    case "expression":
      return AttributeMapping.of(req, { kind: "expression", expr: m.expr });
    case "enum-cases":
      return AttributeMapping.of(req, { kind: "enum-cases", from: AttributePath.of(m.from), cases: m.cases });
    case "unspecified":
      return AttributeMapping.of(req, { kind: "unspecified" });
  }
}
function refUnitMap(seed: {
  unit?: string;
  attrMap?: RawAttributeMapping[];
  eventMap?: RawEventMapping[];
  unmapped?: RawUnmappedTarget[];
}): RefinementUnitMap {
  return RefinementUnitMap.of({
    unit: DesignUnitIdentifier.of(seed.unit ?? "u1"),
    attrMap: AttributeMappings.of((seed.attrMap ?? []).map(wrapMapping)),
    eventMap: EventMappings.of(
      (seed.eventMap ?? []).map((e) => EventMapping.of({ ...e, reqTrigger: TriggerName.of(e.reqTrigger), transitions: TransitionReferences.of(e.transitions.map((t) => TransitionReference.of(t))) })),
    ),
    unmapped: UnmappedDeclarations.of(
      (seed.unmapped ?? []).map((un) => UnmappedTarget.of({ ...un, target: UnmappedTargetReference.of(un.target) })),
    ),
  });
}

const exprMapping = (req: string, path: string) =>
  ({ kind: "expression", req, expr: { op: "ref", path } }) as const;
const enumMapping = (req: string, from: string, cases: { [d: string]: string }) =>
  ({ kind: "enum-cases", req, from, cases }) as const;

describe("attribute mapping totality", () => {
  test("an inherited property name (e.g. \"toString\") does not count as a covered case", () => {
    const mapping = AttributeMapping.of(AttributePath.of("R.state"), { kind: "enum-cases", from: AttributePath.of("D.phase"), cases: { draft: "open" } });
    // from の宣言値に "toString" があっても、cases の own mapping が無ければ欠けとして報告する。
    expect(mapping.missingCasesOver(["draft", "toString"])).toEqual(["toString"]);
    expect(mapping.missingCasesOver(["draft"])).toEqual([]);
    expect(mapping.producedValuesOutside({ includes: (v: string) => v === "open" })).toEqual([]);
    expect(AttributeMapping.of(AttributePath.of("R.x"), { kind: "expression", expr: { op: "ref", path: "D.x" } }).missingCasesOver(["a"])).toEqual([]);
  });
});

describe("alpha substitution", () => {
  // 置換は Result で返る（裁定 15）——成功値を剥ぐ helper。
  const substituted = (e: Expression, post: boolean): Expression => {
    const r = ctx.substitute(e, post);
    if (!r.ok) throw new Error(r.error.message());
    return r.value;
  };
  const ctx = AttributeMappings.of([
    wrapMapping(exprMapping("R.flag", "D.flag")),
    wrapMapping(enumMapping("R.state", "D.phase", { draft: "open", review: "open", done: "closed" })),
    wrapMapping({ kind: "unspecified", req: "R.none" }),
  ]);

  test("covers reports membership of the approved mapping index", () => {
    expect(ctx.covers("R.flag")).toBe(true);
    expect(ctx.covers("R.zzz")).toBe(false);
  });

  test("enum eq expands to the disjunction of design values mapping to the literal", () => {
    const out = substituted({ op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "open" }] }, false);
    expect(out).toEqual({
      op: "or",
      args: [
        { op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "draft" }] },
        { op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "review" }] },
      ],
    });
    const single = substituted({ op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "closed" }] }, false);
    expect(single).toEqual({ op: "eq", args: [{ op: "ref", path: "D.phase" }, { op: "enum", value: "done" }] });
    const none = substituted({ op: "eq", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "ghost" }] }, false);
    expect(none).toEqual({ op: "bool", value: false });
    const ne = substituted({ op: "ne", args: [{ op: "ref", path: "R.state" }, { op: "enum", value: "closed" }] }, false);
    expect(ne.op).toBe("not");
    const primed = substituted({ op: "eq", args: [{ op: "ref", path: "R.state", prime: true }, { op: "enum", value: "closed" }] }, false);
    expect(primed).toEqual({ op: "eq", args: [{ op: "ref", path: "D.phase", prime: true }, { op: "enum", value: "done" }] });
  });

  test("expression mappings substitute (primed in post context) and errors are frozen", () => {
    expect(substituted({ op: "ref", path: "R.flag" }, false)).toEqual({ op: "ref", path: "D.flag" });
    expect(substituted({ op: "ref", path: "R.flag" }, true)).toEqual({ op: "ref", path: "D.flag", prime: true });
    expect(substituted({ op: "and", args: [{ op: "ref", path: "R.flag" }, { op: "bool", value: true }] }, false).args?.[0]).toEqual({ op: "ref", path: "D.flag" });
    const defectOf = (e: Expression): RefinementMapDefect => {
      const r = ctx.substitute(e, false);
      if (r.ok) throw new Error("expected a map defect");
      return r.error;
    };
    expect(defectOf({ op: "ref", path: "R.missing" }).message()).toBe('requirements attribute "R.missing" is not covered by the attrMap');
    expect(defectOf({ op: "ref", path: "R.state" }).message()).toBe('enum-mapped requirements attribute "R.state" is only legal inside eq/ne against an enum literal');
    expect(defectOf({ op: "ref", path: "R.none" }).message()).toBe('attrMap entry for "R.none" declares neither an expression nor enum cases');
    // 引数の欠陥は宣言順の最初のものが返る（旧 throw の順序）。
    expect(defectOf({ op: "and", args: [{ op: "ref", path: "R.flag" }, { op: "ref", path: "R.none" }, { op: "ref", path: "R.missing" }] }).message()).toBe('attrMap entry for "R.none" declares neither an expression nor enum cases');
    const skip = defectOf({ op: "ref", path: "R.missing" }).asCompileErrorSkip(TargetIdentifier.of("OB-1"), "u1");
    expect(skip.reason()).toBe("compile-error");
    expect(skip.detail()).toBe('alpha substitution failed: requirements attribute "R.missing" is not covered by the attrMap');
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
      { id: "SC-1", kind: "accept", frRefs: [], bindings: scenarioBindings({ "R.flag": true }) },
      { id: "SC-2", kind: "reject", frRefs: [], bindings: scenarioBindings({ "R.orphan": 1 }) },
      { id: "SC-3", kind: "accept", frRefs: [], bindings: scenarioBindings({}), event: { trigger: "go" } },
      { id: "SC-4", kind: "accept", frRefs: [], bindings: scenarioBindings({ "R.waived": 1 }) },
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
    const plan = UnitRefinementPlan.of(designUnit, unitMap, req, ArtifactPath.of("construction/x/map.md"));
    expect(plainStatus(plan.statusOfObligation("OB-1"))).toEqual({ kind: "checkable" });
    expect(plainStatus(plan.statusOfObligation("OB-2"))).toEqual({ kind: "checkable" });
    expect(plan.mappedTransitionsOf("OB-2").map((t) => t.asString())).toEqual(["TR-1"]);
    expect(plainStatus(plan.statusOfObligation("OB-3"))).toEqual({ kind: "capability", detail: "temporal refinement is outside v1 scope" });
    expect(plainStatus(plan.statusOfObligation("OB-4"))).toEqual({ kind: "waived", reason: "depends on unmapped attribute(s) R.orphan" });
    expect(plainStatus(plan.statusOfObligation("OB-5"))?.kind).toBe("gap");
    expect(plainStatus(plan.statusOfObligation("OB-6"))).toEqual({ kind: "capability", detail: 'nature "mystery" has no refinement check' });
    expect(plainStatus(plan.statusOfScenario("SC-1"))).toEqual({ kind: "checkable" });
    expect(plainStatus(plan.statusOfScenario("SC-2"))).toEqual({ kind: "waived", reason: "binds unmapped attribute(s) R.orphan" });
    expect(plainStatus(plan.statusOfScenario("SC-3"))).toEqual({ kind: "capability", detail: "event scenarios are not replayed in v1" });
    expect(plainStatus(plan.statusOfScenario("SC-4"))).toEqual({ kind: "waived", reason: "binds unmapped attribute(s) R.waived" });
    const gapDetails = plan.gaps().toArray().map((g) => g.detail());
    expect(gapDetails.some((d) => d.includes('requirements event trigger "ghost" has no eventMap entry'))).toBe(true);
    expect(plan.gaps().toArray().every((g) => g.kind() === "mapping-gap" && g.unit() === "u1")).toBe(true);
    expect(plan.gaps().toArray()[0]?.witness().toDocument()).toEqual({ refs: [{ artifact: "construction/x/map.md", element: "units[u1]" }] });
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
    const plan = UnitRefinementPlan.of(designUnit, badMap, reqLocal, ArtifactPath.of("m.md"));
    const details = plan.gaps().toArray().map((g) => g.detail()).join("\n");
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
    const plan = UnitRefinementPlan.of(designUnit, unitMap, req, ArtifactPath.of("m.md"));
    const smtSkips = plan.smtStatusSkips("u1").toArray().map((s) => `${s.target().asString()}:${s.reason()}`);
    expect(smtSkips).toContain("OB-3:capability");
    expect(smtSkips).toContain("OB-4:waived");
    expect(smtSkips).not.toContain("OB-2:capability");
    const quintSkips = plan.quintStatusSkips(req, "u1").toArray();
    expect(quintSkips.find((s) => s.target().asString() === "OB-2")?.detail())
      .toBe("event simulation and enabledness are checked by the SMT refinement pass only in v1");
    expect(quintSkips.find((s) => s.target().asString() === "SC-1")?.detail())
      .toBe("scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)");
  });

  test("quint extras carry alpha(P) for checkable invariants only", () => {
    const plan = UnitRefinementPlan.of(designUnit, unitMap, req, ArtifactPath.of("m.md"));
    const extras = plan.quintInvariants(req);
    expect(extras.toArray().map((e) => e.reqId().asString())).toEqual(["OB-1"]);
    expect(extras.toArray()[0]?.loweredAs(LoweredIdentifier.of("OB-9")).assertion()).toEqual({ op: "ref", path: "D.flag" });
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
    expect(catalog.eventOf(TargetIdentifier.of("TR-1"))?.guard().op).toBe("and");
    expect(catalog.eventOf(TargetIdentifier.of("TR-1"))?.assignedRhsOf("D.s")).toEqual({ op: "enum", value: "b" });
    expect(catalog.eventOf(TargetIdentifier.of("TR-1"))?.assignedRhsOf("D.n")).toEqual({ op: "int", value: 1 });
    // 分解不能な追加効果は暗黙代入だけが残る（設計パスが報告する）。
    expect(catalog.eventOf(TargetIdentifier.of("TR-2"))?.assignedRhsOf("D.s")).toEqual({ op: "enum", value: "b" });
    expect(catalog.eventOf(TargetIdentifier.of("TR-2"))?.assignedRhsOf("D.n")).toBe(undefined);
    expect(catalog.eventOf(TargetIdentifier.of("DOB-1"))?.assignedRhsOf("D.n")).toEqual({ op: "int", value: 2 });
    // 分解不能な event 義務はカタログに載らない。
    expect(catalog.eventOf(TargetIdentifier.of("DOB-2"))).toBe(null);
    expect(catalog.eventOf(TargetIdentifier.of("DOB-3"))).toBe(null);

    const orEffect = EffectAssignments.parse({ op: "or", args: [] });
    expect(!orEffect.ok && orEffect.error.kind).toBe("effect-not-assignment-conjunction");
    const unprimed = EffectAssignments.parse({ op: "eq", args: [{ op: "ref", path: "x" }, { op: "int", value: 1 }] });
    expect(unprimed.ok).toBe(false);
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
      { id: "SC-1", kind: "accept", frRefs: ["FR-3"], bindings: scenarioBindings({}) },
      { id: "SC-2", kind: "reject", frRefs: [], bindings: scenarioBindings({}) },
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
    ArtifactPath.of("m.md"),
  );
  const solverPlan = (entries: [string, RefinementProbe][]): RefinementSolverPlan =>
    RefinementSolverPlan.of({ pending: KeyedIndex.of(entries.map(([id, p]) => [QueryLabel.of(id), p] as const)), compileSkips: DesignSkips.of([]) });
  const run = (f: RefinementSolverPlan, results: [string, Parameters<typeof RefinementQueryVerdict.of>[0]][]) =>
    f.interpret(RefinementQueryVerdicts.of(KeyedIndex.of(results.map(([id, v]) => [QueryLabel.of(id), RefinementQueryVerdict.of(v)] as const))), req, plan, "u1");

  test("each probe kind emits its frozen finding on the deciding verdict", () => {
    const out = run(
      solverPlan([
        ["rv:OB-1", RefinementProbe.invariant(ObligationIdentifier.of("OB-1"))],
        ["rs:SC-1", RefinementProbe.scenario(ScenarioIdentifier.of("SC-1"))],
        ["rs:SC-2", RefinementProbe.scenario(ScenarioIdentifier.of("SC-2"))],
        ["re:OB-2", RefinementProbe.enabledness(ObligationIdentifier.of("OB-2"))],
        ["rs2:OB-2:TR-1", RefinementProbe.simulation(ObligationIdentifier.of("OB-2"), TransitionReference.of("TR-1"))],
      ]),
      [
        ["rv:OB-1", { status: "sat", decodedModel: { "D.flag": true } }],
        ["rs:SC-1", { status: "unsat", core: ["inv_b", "inv_a"] }],
        ["rs:SC-2", { status: "sat", decodedModel: { "D.flag": false } }],
        ["re:OB-2", { status: "sat", decodedModel: { "D.s": "a" } }],
        ["rs2:OB-2:TR-1", { status: "sat", decodedModel: { "D.s": "a" }, decodedPostModel: { "D.s": "b" } }],
      ],
    );
    expect(out.findings.toArray().map((f) => `${f.kind()}:${f.targets().joined(",")}`)).toEqual([
      "refinement-violation:OB-1",
      "refinement-violation:SC-1",
      "refinement-violation:SC-2",
      "completeness-gap:OB-2,TR-1,TR-2",
      "refinement-violation:OB-2,TR-1",
    ]);
    expect(out.findings.toArray()[0]?.functionalRequirementReferences().toStrings()).toEqual(["FR-1", "FR-2"]);
    expect(out.findings.toArray()[1]?.witness().toDocument()).toEqual({ core: ["inv_a", "inv_b"] });
    expect(out.findings.toArray()[4]?.witness().toDocument()).toEqual({ trace: [{ "D.s": "a" }, { "D.s": "b" }] });
    expect(out.findings.toArray()[0]?.detail()).toContain("The design admits what the verified requirements forbid.");
    expect(out.findings.toArray()[4]?.detail()).toContain("produces an abstract post-state that violates the requirements effect or the abstract frame");
  });

  test("quiet verdicts emit nothing; undecided and missing become the frozen timeout skip", () => {
    const out = run(
      solverPlan([
        ["rv:OB-1", RefinementProbe.invariant(ObligationIdentifier.of("OB-1"))],
        ["rs:SC-1", RefinementProbe.scenario(ScenarioIdentifier.of("SC-1"))],
        ["rs:SC-2", RefinementProbe.scenario(ScenarioIdentifier.of("SC-2"))],
        ["re:OB-2", RefinementProbe.enabledness(ObligationIdentifier.of("OB-2"))],
        ["rs2:OB-2:TR-1", RefinementProbe.simulation(ObligationIdentifier.of("OB-2"), TransitionReference.of("TR-1"))],
        ["rv:OB-9", RefinementProbe.invariant(ObligationIdentifier.of("OB-9"))],
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
    expect(out.skipped.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual(["OB-2:timeout", "OB-9:timeout"]);
    expect(out.skipped.toArray()[0]?.detail()).toBe("refinement query rs2:OB-2:TR-1 exceeded the solver budget or errored");
  });
});

describe("refinement collections (first-class operations)", () => {
  test("of/add/iterator/toArray and the map-side set knowledge", () => {
    const am = AttributeMappings.of([]).add(wrapMapping(exprMapping("R.a", "D.a")));
    expect([...am].length).toBe(1);
    expect(am.toArray()[0]?.req().asString()).toBe("R.a");

    const tref = (raw: string): TransitionReference => TransitionReference.of(raw);
    const tr = TransitionReferences.of([tref("TR-2")]).add(tref("TR-10"));
    expect([...tr].map((t) => t.asString())).toEqual(["TR-2", "TR-10"]);
    expect(tr.isEmpty()).toBe(false);
    expect(TransitionReferences.of([]).isEmpty()).toBe(true);
    expect(tr.unknownAmong(new Set(["TR-2"]))).toEqual(["TR-10"]);
    // unknownAmong は素の辞書順、sortedCanonically は正準順（数値尾）。
    expect(tr.sortedCanonically().map((t) => t.asString())).toEqual(["TR-2", "TR-10"]);
    expect(tr.toArray().map((t) => t.asString())).toEqual(["TR-2", "TR-10"]);
    expect(tref("TR-1").equals(tref("TR-1"))).toBe(true);
    expect(TransitionReference.parse("").ok).toBe(false);

    const trig = (raw: string): TriggerName => TriggerName.of(raw);
    const em = EventMappings.of([]).add(EventMapping.of({ reqTrigger: trig("go"), transitions: TransitionReferences.of([tref("TR-1")]) }))
      .add(EventMapping.of({ reqTrigger: trig("go"), transitions: TransitionReferences.of([tref("TR-9")]), waived: { reason: "later" } }));
    expect([...em].length).toBe(2);
    // 重複トリガは最後の宣言が勝つ（旧 new Map の凍結挙動）。
    expect([...(em.ofTrigger(trig("go"))?.transitions() ?? TransitionReferences.of([]))].map((t) => t.asString())).toEqual(["TR-9"]);
    expect(em.ofTrigger(trig("go"))?.waiverReason()).toBe("later");
    expect(em.toArray()[0]?.waiverReason()).toBe(null);
    expect(em.ofTrigger(trig("ghost"))).toBe(undefined);
    expect(em.toArray().length).toBe(2);

    const uref = (raw: string): UnmappedTargetReference => UnmappedTargetReference.of(raw);
    const un = UnmappedDeclarations.of([UnmappedTarget.of({ target: uref("R.x"), reason: "first" })]).add(UnmappedTarget.of({ target: uref("R.x"), reason: "last" }));
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
    expect(maps.mapOf(DesignUnitIdentifier.of("u1"))).toBe(m1);
    expect(maps.mapOf(DesignUnitIdentifier.of("zz"))).toBe(undefined);
    expect(maps.toArray().length).toBe(2);
  });

  test("requirements-view collections own their index knowledge", () => {
    const vals = EnumerationMembers.of((["open"]).map((value) => EnumerationMember.of(value))).add(EnumerationMember.of("closed"));
    expect([...vals].map((value) => value.asString())).toEqual(["open", "closed"]);
    expect(vals.includes("closed")).toBe(true);
    expect(vals.includes("ghost")).toBe(false);
    expect(vals.toArray().map((value) => value.asString())).toEqual(["open", "closed"]);

    const apath = (raw: string): AttributePath => AttributePath.of(raw);
    const attrs = RefinementAttributes.of([RefinementAttribute.of({ path: apath("R.b"), kind: "bool" })])
      .add(RefinementAttribute.of({ path: apath("R.a"), kind: "int" }))
      .add(RefinementAttribute.of({ path: apath("R.a"), kind: "bool", values: EnumerationMembers.of((["x"]).map((value) => EnumerationMember.of(value))) }));
    expect([...attrs].length).toBe(3);
    expect(attrs.covers("R.a")).toBe(true);
    expect(attrs.covers("R.z")).toBe(false);
    // path 索引は最後の宣言が勝つ。
    expect(attrs.byPath("R.a")?.kind()).toBe("bool");
    expect(attrs.byPath("R.a")?.isEnum()).toBe(false);
    expect(attrs.byPath("R.a")?.declaredValues()?.toArray().map((value) => value.asString())).toEqual(["x"]);
    expect(attrs.byPath("R.b")?.isAt(apath("R.b"))).toBe(true);
    expect(attrs.byPath("R.z")).toBe(undefined);
    expect(attrs.sortedByPath().toArray().map((a) => a.path().asString())).toEqual(["R.a", "R.a", "R.b"]);

    const rob = (id: string, nature: string) => RefinementObligation.of({ id: ObligationIdentifier.of(id), nature: ObligationNature.of(nature), functionalRequirementReferences: FunctionalRequirementReferences.of([]) });
    const obs = RefinementObligations.of([rob("OB-2", "invariant")])
      .add(rob("OB-1", "event"))
      .add(rob("OB-1", "numeric"));
    expect([...obs].length).toBe(3);
    expect(obs.byId("OB-1")?.nature().asString()).toBe("numeric");
    expect(obs.byId("OB-9")).toBe(undefined);
    expect(obs.sortedCanonically().toArray().map((o) => o.id().asString())).toEqual(["OB-1", "OB-1", "OB-2"]);

    const rsc = (id: string, kind: "accept" | "reject") => RefinementScenario.of({ id: ScenarioIdentifier.of(id), kind, functionalRequirementReferences: FunctionalRequirementReferences.of([]), bindings: scenarioBindings({}) });
    const scs = RefinementScenarios.of([rsc("SC-2", "accept")])
      .add(rsc("SC-1", "reject"))
      .add(rsc("SC-1", "accept"));
    expect([...scs].length).toBe(3);
    expect(scs.byId("SC-1")?.kind()).toBe("accept");
    expect(scs.byId("SC-9")).toBe(undefined);
    expect(scs.toArray().length).toBe(3);
  });

  test("quint invariant collection knows its req ids", () => {
    const inv = RefinementQuintInvariants.of([]).add(RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), FunctionalRequirementReferences.of(Array.from(["FR-1"], (raw) => RequirementIdentifier.of(raw))), { op: "bool", value: true }));
    expect(inv.isEmpty()).toBe(false);
    expect([...inv].length).toBe(1);
    expect([...inv.reqIds()]).toEqual(["OB-1"]);
    expect(inv.toArray()[0]?.reqId().asString()).toBe("OB-1");
    expect(inv.toArray()[0]?.reqTarget().asString()).toBe("OB-1");
    const lowered = inv.toArray()[0]?.loweredAs(LoweredIdentifier.of("OB-7"));
    expect(lowered?.id().asString()).toBe("OB-7");
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
      ArtifactPath.of("m.md"),
    );
    expect(plainStatus(plan.statusOfObligation("OB-2"))).toEqual({ kind: "checkable" });
    const built = buildRefinementQueries(u, req, plan);
    const enabledness = built.queries.find((q) => q.id === "re:OB-2");
    expect(enabledness).toBeDefined();
    // 発火可能な設計ガードなし → notEnabled は "true"（黙った除外の凍結面）。
    expect(enabledness?.script).toContain("(assert (=> ne_OB_2 true))");
    expect(built.plan.compileSkips().toArray()).toEqual([]);
  });
});

describe("RefinementMaterials aggregate (repository ruling)", () => {
  test("carries its id, and the state predicates guard the active accessors", () => {
    const id = RefinementMaterialsIdentifier.of(DesignModelIdentifier.of(ap("/r/m.md")));
    const inactive = RefinementMaterials.inactive(id);
    expect(inactive.id().equals(id)).toBe(true);
    expect(inactive.isActive()).toBe(false);
    expect(() => inactive.requirements()).toThrow("defect");
    expect(() => inactive.mapAcquisition()).toThrow("defect");
    const active = RefinementMaterials.active(id, requirements({}), RefinementMapAcquisition.absent(null));
    expect(active.isActive()).toBe(true);
    expect(active.mapAcquisition().match({ absent: (error) => `absent:${error}`, loaded: () => "loaded" })).toBe("absent:null");
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
      const repo = new RefinementMapRepositoryImplementation(mapSchemaPath);
      const found = repo.findById(RefinementMapIdentifier.of(ap(path)));
      expect(found.ok).toBe(true);
      if (!found.ok) return;
      expect(Buffer.from(found.value.sourceDocument()).toString("utf-8")).toBe(mapDoc);
      expect(found.value.units().toArray().length).toBeGreaterThan(0);
      rmSync(path);
      expect(repo.store(found.value).ok).toBe(true);
      expect(readFileSync(path, "utf-8")).toBe(mapDoc);
      // 不在は not-found、壊れた文書は composite と同一の凍結文言で corrupt。
      const missing = repo.findById(RefinementMapIdentifier.of(ap(join(dir, "nowhere.md"))));
      expect(!missing.ok && missing.error.kind).toBe("not-found");
      writeFileSync(path, "no fence here\n");
      const corrupt = repo.findById(RefinementMapIdentifier.of(ap(path)));
      expect(!corrupt.ok && corrupt.error.kind === "corrupt" && corrupt.error.cause).toBe("refinement map does not contain exactly one ```json fence");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("split-file coverage pins (one-public-type refactor)", () => {
  test("solver plan expose compile skips and issue-order iteration; unmapped target parses", () => {
    const f = RefinementSolverPlan.of({
      pending: KeyedIndex.of([
        [QueryLabel.of("rv:OB-9"), RefinementProbe.invariant(ObligationIdentifier.of("OB-9"))] as const,
      ]),
      compileSkips: DesignSkips.of([]),
    });
    expect([...f].map(([id]) => id.asString())).toEqual(["rv:OB-9"]);
    expect(f.compileSkips().toArray()).toEqual([]);
    const parsed = UnmappedTargetReference.parse("OB-1");
    expect(parsed.ok && parsed.value.equals(UnmappedTargetReference.of("OB-1"))).toBe(true);
    expect(UnmappedTargetReference.parse("").ok).toBe(false);
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
    const plan = UnitRefinementPlan.of(u, refUnitMap({ attrMap: [{ kind: "unspecified", req: "R.flag" }] }), req, ArtifactPath.of("m.md"));
    const quint = plan.quintStatusSkips(req, "u1").toArray().filter((s) => s.reason() === "compile-error");
    expect(quint.map((s) => ({ target: s.target().asString(), reason: s.reason(), unit: s.unit(), detail: s.detail() }))).toEqual([{
      target: "OB-1",
      reason: "compile-error",
      unit: "u1",
      detail: 'alpha substitution failed: attrMap entry for "R.flag" declares neither an expression nor enum cases',
    }]);
    // SMT 側の compileSkips と逐語で対（凍結解除 #38 項 1 の対称性）。
    expect(buildRefinementQueries(u, req, plan).plan.compileSkips().toArray()).toEqual(quint);
  });

  test("a timed-out runtime is not retried on the fallback runtime (thaw #38 item 2)", () => {
    const u = designUnit();
    const req = reqOneInvariant();
    const plan = UnitRefinementPlan.of(u, refUnitMap({ attrMap: [exprMapping("R.flag", "D.flag")] }), req, ArtifactPath.of("m.md"));
    const host = join(mkdtempSync(join(tmpdir(), "sleepy-child-")), "sleepy.ts");
    writeFileSync(host, "setTimeout(() => process.exit(0), 30_000);\n");
    const started = Date.now();
    // budgetMs -14_800 → spawnSync timeout 200ms：眠る子は必ず ETIMEDOUT。
    const out = new RefinementSolverClientImplementation({
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
    const ctx: RefinementSatisfiabilityModuloTheoriesContext = { attrs: [attr], byPath: new Map([["o.n", attr]]) };
    expect(decodeDesignModel(ctx, { v_o_n: "10000000000000000000021" }, false)).toEqual({ "o.n": "10000000000000000000021" });
    expect(decodeDesignModel(ctx, { v_o_n: "(- 10000000000000000000021)" }, false)).toEqual({ "o.n": "-10000000000000000000021" });
    expect(decodeDesignModel(ctx, { v_o_n: "7" }, false)).toEqual({ "o.n": 7 });
  });
});

describe("unmapped dependencies of an event obligation are listed in canonical order (ruling 1)", () => {
  test("guard and effect dependencies merge, deduplicate and sort by attribute path", () => {
    const req = requirements({
      attributes: [{ path: "R.b", kind: "bool" }, { path: "R.a", kind: "bool" }],
      obligations: [{ id: "OB-1", nature: "event", frRefs: [], trigger: "go", guard: { op: "ref", path: "R.b" }, effect: { op: "ref", path: "R.a" } }],
    });
    const plan = UnitRefinementPlan.of(unit({}), refUnitMap({ unmapped: [{ target: "R.a", reason: "" }, { target: "R.b", reason: "" }] }), req, ArtifactPath.of("m.md"));
    expect(plainStatus(plan.statusOfObligation("OB-1"))).toEqual({ kind: "gap", detail: 'requirements event trigger "go" has no eventMap entry (map it to design transitions or waive it)' });
  });
});
