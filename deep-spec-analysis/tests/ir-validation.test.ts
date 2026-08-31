// 契約1／契約3 の IR バリデータを in-process で駆動するスイート（PR7）。
//
// 主証拠は「子プロセスで実センサーを撃った verdict 行」と「同じ入力を
// in-process のインタラクタ＋実 Impl で処理した結果」のバイト一致。両者が
// 一致する限り、well-formedness の移設は観測面を動かしていない。
// 併せて、子プロセス経由では in-process 計測に乗らないドメインの分岐を
// 直接叩く（domain 層 90% 床の担保）。

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ArtifactPath, AttributeBound, ErrorMessages, RequirementIds } from "../tools/kernel/domain/index.ts";
import { DesignIrValidationMaterialsRepositoryImpl, DesignModelRepositoryImpl } from "../tools/design/adapter/index.ts";
import {
  BindingPairs,
  BrReferenceIndex,
  BrRefs,
  DeclaredValues,
  type DesignBackgroundDecl,
  DesignAttributeDecls,
  DesignBackgroundDecls,
  DesignEntityDecls,
  type DesignIgnoreDecl,
  DesignIgnoreDecls,
  type DesignMachineDecl,
  DesignMachineDecls,
  DesignModelId,
  type DesignObligationDecl,
  DesignObligationDecls,
  type DesignScenarioDecl,
  DesignScenarioDecls,
  type DesignTransitionDecl,
  DesignTransitionDecls,
  type DesignUnitDecl,
  DesignUnitDecls,
  designWellFormednessErrors,
  InitialStates,
  UnformalizedTargets,
  DesignUnitId,
  DesignTransitionId,
  DesignScenarioId,
  DesignObligationOrigin,
  DesignObligationId,
  DesignMachineId,
  DesignEntityName,
  DesignBackgroundId,
  DesignAttributeName,
  DesignIrValidationMaterialsId,
} from "../tools/design/domain/index.ts";
import { ValidateDesignIrUseCase, type ValidateDesignIrOutcome } from "../tools/design/usecase/index.ts";
import {
  FormalModelRepositoryImpl,
  IrValidationMaterialsRepositoryImpl,
  RequirementsSourceRepositoryImpl,
} from "../tools/requirements/adapter/index.ts";
import {
  FormalModelId,
  FrReferenceIndex,
  FrRefs,
  type IrBackgroundDecl,
  type IrObligationDecl,
  type IrScenarioDecl,
  IrAttributeDecls,
  IrBackgroundDecls,
  IrBindingPairs,
  IrDeclaredValues,
  IrEntityDecls,
  IrModelDecl,
  IrObligationDecls,
  IrScenarioDecls,
  RequirementsSourceId,
  SourceAnchor,
  ScenarioId,
  ObligationId,
  IrEntityName,
  IrAttributeName,
  BackgroundAssumptionId,
  IrValidationMaterialsId,
  FrRefClaims,
} from "../tools/requirements/domain/index.ts";
import { ValidateIrUseCase, type ValidateIrOutcome } from "../tools/requirements/usecase/index.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures");
const irSchemaPath = join(toolsDir, "data", "deep-spec-ir-schema.json");
const designSchemaPath = join(toolsDir, "data", "deep-spec-design-ir-schema.json");

const MAX_REPORTED_ERRORS = 25;

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

// entry の描画と同一の行を組む（比較対象は子プロセスの stdout そのもの）。
function renderVerdict(outcome: ValidateIrOutcome | ValidateDesignIrOutcome): string {
  if (outcome.kind === "not-applicable") {
    return `${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}\n`;
  }
  return `${JSON.stringify({
    pass: outcome.pass,
    findings_count: outcome.errors.length,
    errors: outcome.errors.slice(0, MAX_REPORTED_ERRORS),
  })}\n`;
}

function fire(tool: string, stage: string, outputPath: string): string {
  const res = spawnSync("bun", [join(toolsDir, tool), "--stage", stage, "--output-path", outputPath], {
    encoding: "utf-8",
    timeout: 120_000,
  });
  expect(res.status).toBe(0);
  return res.stdout ?? "";
}

function makeIrRecord(modelFixture: string): { record: string; modelPath: string } {
  const record = join(tmpdir(), `deep-spec-ir-valid-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(record, "inception", "requirements-analysis"), { recursive: true });
  mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
  cpSync(
    join(fixtures, "conformance", "requirements.md"),
    join(record, "inception", "requirements-analysis", "requirements.md"),
  );
  const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
  cpSync(modelFixture, modelPath);
  return { record, modelPath };
}

function makeDesignRecord(): { record: string; modelPath: string } {
  const record = join(tmpdir(), `deep-spec-design-ir-valid-${Math.random().toString(36).slice(2)}`);
  cpSync(join(fixtures, "design", "record"), record, { recursive: true });
  return {
    record,
    modelPath: join(
      record,
      "construction",
      "deep-spec-analysis-functional-verify",
      "deep-spec-analysis-functional-formal-model.md",
    ),
  };
}

function irUseCase(): ValidateIrUseCase {
  return new ValidateIrUseCase(
    new IrValidationMaterialsRepositoryImpl({ schemaPath: irSchemaPath }),
    new RequirementsSourceRepositoryImpl(),
  );
}

function designUseCase(): ValidateDesignIrUseCase {
  return new ValidateDesignIrUseCase(new DesignIrValidationMaterialsRepositoryImpl({ schemaPath: designSchemaPath }));
}

describe("ValidateIrUseCase reproduces the ir-valid sensor byte-for-byte", () => {
  const stage = "deep-spec-analysis-verify";

  test("canonical fixture", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("broken fixture — semantic defects and frRef traceability", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "invalid", "deep-spec-analysis-formal-model.md"));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).pass).toBe(false);
  });

  test("drifted requirements — sourceDigest mismatch", () => {
    const { record, modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const req = join(record, "inception", "requirements-analysis", "requirements.md");
    writeFileSync(req, `${readFileSync(req, "utf-8")}\n- FR-9: 監査ログを5年間保持しなければならない。\n`);
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors.join("\n")).toContain("does not match requirements.md");
  });

  test("missing sourceDigest — the value to add is handed back", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace(/^\s*"sourceDigest": "[0-9a-f]{64}",\n/m, ""));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors.join("\n")).toContain('add "sourceDigest"');
  });

  test("requirements.md absent — frRefs cannot be reverse-verified", () => {
    const record = join(tmpdir(), `deep-spec-ir-valid-noreq-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
    const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
    cpSync(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"), modelPath);
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors).toContain(
      "requirements.md not found under this intent record — frRefs cannot be reverse-verified",
    );
  });

  test("fence and JSON failures short-circuit before the version check", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, "# no fence here\n");
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath));

    writeFileSync(modelPath, "```json\n{ not json\n```\n");
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath));

    writeFileSync(modelPath, "```json\n[]\n```\n");
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath));
  });

  test("schema absent — the acquisition fails before anything else", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const useCase = new ValidateIrUseCase(
      new IrValidationMaterialsRepositoryImpl({ schemaPath: join(tmpdir(), "no-such-ir-schema.json") }),
      new RequirementsSourceRepositoryImpl(),
    );
    const outcome = useCase.execute(FormalModelId.of(ap(modelPath)));
    expect(outcome.kind).toBe("verdict");
    if (outcome.kind !== "verdict") return;
    expect(outcome.pass).toBe(false);
    expect(outcome.errors[0]).toContain("IR schema not installed at");
  });

  test("unsupported major version is reported before the schema errors", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace(/"irVersion": "1\.[0-9]+\.[0-9]+"/, '"irVersion": "2.0.0"'));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors[0]).toContain("unsupported major version");
  });

  test("a write that is not the formal model is not applicable", () => {
    const { record } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const other = join(record, "inception", "deep-spec-analysis-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    expect(irUseCase().execute(FormalModelId.of(ap(other))).kind).toBe("not-applicable");
    expect(renderVerdict(irUseCase().execute(FormalModelId.of(ap(other))))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, other));
  });
});

describe("ValidateDesignIrUseCase reproduces the design-ir-valid sensor byte-for-byte", () => {
  const stage = "deep-spec-analysis-functional-verify";

  test("canonical fixture", () => {
    const { modelPath } = makeDesignRecord();
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(DesignModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("invalid fixture — every planted defect, in the frozen order", () => {
    const { modelPath } = makeDesignRecord();
    cpSync(join(fixtures, "design", "invalid-formal-model.md"), modelPath);
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(DesignModelId.of(ap(modelPath))))).toBe(viaSensor);
    const verdict = JSON.parse(viaSensor);
    expect(verdict.pass).toBe(false);
    const all = verdict.errors.join("\n");
    expect(all).toContain('duplicate id "TR-1"');
    expect(all).toContain("assigns the machine's own attribute");
    expect(all).toContain("BR coverage: rule BR1.3");
    expect(all).toContain("no construction/u9-ghost/ directory exists");
  });

  test("fence and JSON failures short-circuit", () => {
    const { modelPath } = makeDesignRecord();
    writeFileSync(modelPath, "# no fence\n");
    expect(renderVerdict(designUseCase().execute(DesignModelId.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n{ not json\n```\n");
    expect(renderVerdict(designUseCase().execute(DesignModelId.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n[]\n```\n");
    expect(renderVerdict(designUseCase().execute(DesignModelId.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );
  });

  test("schema absent — the acquisition fails before anything else", () => {
    const { modelPath } = makeDesignRecord();
    const useCase = new ValidateDesignIrUseCase(
      new DesignIrValidationMaterialsRepositoryImpl({ schemaPath: join(tmpdir(), "no-such-design-schema.json") }),
    );
    const outcome = useCase.execute(DesignModelId.of(ap(modelPath)));
    expect(outcome.kind).toBe("verdict");
    if (outcome.kind !== "verdict") return;
    expect(outcome.errors[0]).toContain("design IR schema not installed at");
  });

  test("unsupported major version", () => {
    const { modelPath } = makeDesignRecord();
    writeFileSync(
      modelPath,
      readFileSync(modelPath, "utf-8").replace(/"irVersion": "1\.[0-9]+\.[0-9]+"/, '"irVersion": "3.0.0"'),
    );
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(DesignModelId.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors[0]).toContain("unsupported major version");
  });

  test("a write that is not the functional formal model is not applicable", () => {
    const { record } = makeDesignRecord();
    const other = join(record, "construction", "deep-spec-analysis-functional-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    expect(designUseCase().execute(DesignModelId.of(ap(other))).kind).toBe("not-applicable");
  });
});

describe("FrReferenceIndex", () => {
  test("collects owners per frRef and reports the missing ones sorted", () => {
    const index = FrReferenceIndex.of([
      { owner: "OB-2", frRefs: FrRefs.of(["FR-1", "FR-9"]) },
      { owner: "OB-1", frRefs: FrRefs.of(["FR-9"]) },
      { owner: "scenarios[3]", frRefs: FrRefs.of([]) },
    ]);
    expect(index.referencedIds().sort()).toEqual(["FR-1", "FR-9"]);
    expect(index.missingErrors(RequirementIds.of(["FR-1"]))).toEqual([
      'frRef "FR-9" (used by OB-1, OB-2) does not exist in requirements.md',
    ]);
    expect(index.missingErrors(RequirementIds.of(["FR-1", "FR-9"]))).toEqual([]);
  });
});

describe("RequirementsSourceId", () => {
  test("identity is the record root, compared by value", () => {
    const a = RequirementsSourceId.of(ap("/records/r1"));
    const b = RequirementsSourceId.of(ap("/records/r1"));
    const c = RequirementsSourceId.of(ap("/records/r2"));
    expect(a.recordRoot().asString()).toBe("/records/r1");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  test("the repository resolves by the aggregate id, wherever the phase directory sits", () => {
    const record = join(tmpdir(), `deep-spec-source-id-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "construction", "requirements-analysis"), { recursive: true });
    writeFileSync(join(record, "construction", "requirements-analysis", "requirements.md"), "- FR-1: x\n");
    const source = new RequirementsSourceRepositoryImpl().findById(RequirementsSourceId.of(ap(record)));
    expect(source.ok).toBe(true);
    expect([...(source.ok ? source.value.knownIds : [])]).toEqual(["FR-1"]);
    const missing = new RequirementsSourceRepositoryImpl().findById(RequirementsSourceId.of(ap(join(record, "nowhere"))));
    expect(!missing.ok && missing.error.kind).toBe("not-found");
  });
});

describe("SourceAnchor", () => {
  test("an absent digest hands back the value to stamp", () => {
    expect(SourceAnchor.of(null, "abc").errors()).toEqual([
      'IR has no sourceDigest — requirements drift would be undetectable; add "sourceDigest": "abc" (sha256 of requirements.md) to the IR',
    ]);
  });

  test("a drifted digest names both sides", () => {
    expect(SourceAnchor.of("old", "new").errors()).toEqual([
      "sourceDigest old does not match requirements.md (sha256 new) — the requirements changed since formalization; re-formalize against the current text and restamp the digest",
    ]);
  });

  test("a matching digest is silent", () => {
    expect(SourceAnchor.of("same", "same").errors()).toEqual([]);
  });
});

describe("BrReferenceIndex", () => {
  test("extracts BR ids from rules markdown", () => {
    const index = BrReferenceIndex.fromRules("- BR2.1 なにか\n- BR1.10 別の規則\n- BR1.10 再掲\n- BRX.1 は id ではない\n");
    expect(index.sortedIds()).toEqual(["BR1.10", "BR2.1"]);
    expect(index.has("BR2.1")).toBe(true);
    expect(index.has("BR9.9")).toBe(false);
  });
});

describe("modelWellFormednessErrors (contract 1 domain branches)", () => {
  // テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
  type RawIrAttr = { name: string; kind: string; values?: string[]; min?: number; max?: number };
  type RawIrEntity = { name: string; attributes: RawIrAttr[] };
  type RawIrObligation = Omit<IrObligationDecl, "id"> & { id: string };
  type RawIrScenario = Omit<IrScenarioDecl, "id" | "bindings"> & { id: string; bindings: (readonly [string, unknown])[] };
  type RawIrBackground = Omit<IrBackgroundDecl, "id"> & { id: string };
  function irView(overrides: {
    entities?: RawIrEntity[];
    obligations?: RawIrObligation[];
    scenarios?: RawIrScenario[];
    background?: RawIrBackground[];
  }): IrModelDecl {
    return IrModelDecl.reconstitute({
      entities: IrEntityDecls.of(
        (overrides.entities ?? []).map((e) => ({
          name: IrEntityName.reconstitute(e.name),
          attributes: IrAttributeDecls.of(
            e.attributes.map((a) => ({
              ...a,
              name: IrAttributeName.reconstitute(a.name),
              min: a.min === undefined ? undefined : AttributeBound.reconstitute(a.min),
              max: a.max === undefined ? undefined : AttributeBound.reconstitute(a.max),
              values: a.values === undefined ? undefined : IrDeclaredValues.of(a.values),
            })),
          ),
        })),
      ),
      obligations: IrObligationDecls.of(
        (overrides.obligations ?? []).map((ob) => ({ ...ob, id: ObligationId.reconstitute(ob.id) })),
      ),
      scenarios: IrScenarioDecls.of(
        (overrides.scenarios ?? []).map((sc) => ({ ...sc, id: ScenarioId.reconstitute(sc.id), bindings: IrBindingPairs.of(sc.bindings) })),
      ),
      background: IrBackgroundDecls.of(
        (overrides.background ?? []).map((bg) => ({ ...bg, id: BackgroundAssumptionId.reconstitute(bg.id) })),
      ),
    });
  }

  test("a well-formed model is silent", () => {
    expect(
      irView({
        entities: [{ name: "order", attributes: [{ name: "qty", kind: "int", min: 0, max: 5 }] }],
        obligations: [{ id: "OB-1", assert: { op: "ref", path: "order.qty" } }],
      }).wellFormednessErrors(),
    ).toEqual([]);
  });

  test("duplicate entities and attributes, and an inverted int range", () => {
    expect(
      irView({
        entities: [
          { name: "order", attributes: [{ name: "qty", kind: "int", min: 9, max: 1 }, { name: "qty", kind: "bool" }] },
          { name: "order", attributes: [] },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      "schema: order.qty: min > max",
      'schema: duplicate attribute "order.qty"',
      'schema: duplicate entity "order"',
    ]);
  });

  test("unresolvable references, illegal primes and unknown enum literals", () => {
    expect(
      irView({
        entities: [{ name: "order", attributes: [{ name: "status", kind: "enum", values: ["open"] }] }],
        obligations: [
          {
            id: "OB-1",
            assert: {
              op: "and",
              args: [
                { op: "ref", path: "order.total" },
                { op: "ref", path: "order.status", prime: true },
                { op: "enum", value: "closed" },
              ],
            },
          },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      'obligation OB-1: unresolvable reference "order.total"',
      'obligation OB-1: primed reference "order.status" is only legal in event effects and event-scenario expectations',
      'obligation OB-1: enum literal "closed" is not a value of any declared enum attribute',
    ]);
  });

  test("primes are legal inside an effect, and temporal branches are walked", () => {
    expect(
      irView({
        entities: [{ name: "order", attributes: [{ name: "qty", kind: "int", min: 0, max: 2 }] }],
        obligations: [
          {
            id: "OB-1",
            effect: { op: "ref", path: "order.qty", prime: true },
            guard: { op: "ref", path: "order.qty" },
            temporal: {
              assert: { op: "ref", path: "order.ghost" },
              from: { op: "ref", path: "order.qty" },
              to: { op: "ref", path: "order.qty" },
            },
          },
        ],
      }).wellFormednessErrors(),
    ).toEqual(['obligation OB-1: unresolvable reference "order.ghost"']);
  });

  test("duplicate ids are reported across obligations, scenarios and background", () => {
    expect(
      irView({
        obligations: [{ id: "X-1" }],
        scenarios: [{ id: "X-1", bindings: [], hasEvent: false }],
        background: [{ id: "X-1" }],
      }).wellFormednessErrors(),
    ).toEqual([
      'scenario X-1: duplicate id "X-1"',
      'background X-1: duplicate id "X-1"',
    ]);
  });

  test("scenario bindings are typed against the attribute catalogue", () => {
    expect(
      irView({
        entities: [
          {
            name: "order",
            attributes: [
              { name: "qty", kind: "int", min: 0, max: 5 },
              { name: "blocked", kind: "bool" },
              { name: "status", kind: "enum", values: ["open"] },
            ],
          },
        ],
        scenarios: [
          {
            id: "SC-1",
            bindings: [
              ["order.qty", 1.5],
              ["order.blocked", true],
              ["order.status", "closed"],
              ["order.ghost", 1],
            ],
            hasEvent: true,
            expect: { op: "ref", path: "order.qty", prime: true },
          },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      'scenario SC-1: binding value 1.5 does not fit int attribute "order.qty"',
      'scenario SC-1: binding value "closed" does not fit enum attribute "order.status"',
      'scenario SC-1: binding for unknown attribute "order.ghost"',
    ]);
  });

  test("background assertions are walked", () => {
    expect(
      irView({ background: [{ id: "BG-1", assert: { op: "ref", path: "a.b" } }] }).wellFormednessErrors(),
    ).toEqual(['background BG-1: unresolvable reference "a.b"']);
  });
});

describe("designWellFormednessErrors (contract 3 domain branches)", () => {
  // テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
  type RawAttr = { name: string; kind: string; values?: string[]; min?: number; max?: number };
  type RawEntity = { name: string; attributes: RawAttr[] };
  type RawObligation = Omit<DesignObligationDecl, "id" | "origin" | "brRefs"> & { id: string; origin?: string; brRefs?: string[] };
  type RawTransition = Omit<DesignTransitionDecl, "id" | "brRefs"> & { id: string; brRefs?: string[] };
  type RawMachine = Omit<DesignMachineDecl, "id" | "initial" | "transitions" | "ignores"> & {
    id: string;
    initial: string[];
    transitions: RawTransition[];
    ignores: DesignIgnoreDecl[];
  };
  type RawScenario = Omit<DesignScenarioDecl, "id" | "bindings" | "brRefs"> & {
    id: string;
    bindings: (readonly [string, unknown])[];
    brRefs?: string[];
  };
  type RawBackground = Omit<DesignBackgroundDecl, "id"> & { id: string };
  type RawUnit = {
    entities?: RawEntity[];
    obligations?: RawObligation[];
    stateMachines?: RawMachine[];
    scenarios?: RawScenario[];
    background?: RawBackground[];
    unformalizedTargets?: string[];
    directoryExists?: boolean;
    rulesMarkdown?: string | null;
  };
  const brRefs = (refs: string[] | undefined) => (refs === undefined ? undefined : BrRefs.of(refs));
  function unit(overrides: RawUnit): DesignUnitDecl {
    return {
      unit: DesignUnitId.of("u1"),
      entities: DesignEntityDecls.of(
        (overrides.entities ?? []).map((e) => ({
          name: DesignEntityName.reconstitute(e.name),
          attributes: DesignAttributeDecls.of(
            e.attributes.map((a) => ({
              ...a,
              name: DesignAttributeName.reconstitute(a.name),
              min: a.min === undefined ? undefined : AttributeBound.reconstitute(a.min),
              max: a.max === undefined ? undefined : AttributeBound.reconstitute(a.max),
              values: a.values === undefined ? undefined : DeclaredValues.of(a.values),
            })),
          ),
        })),
      ),
      obligations: DesignObligationDecls.of(
        (overrides.obligations ?? []).map((ob) => ({
          ...ob,
          id: DesignObligationId.reconstitute(ob.id),
          origin: ob.origin === undefined ? undefined : DesignObligationOrigin.reconstitute(ob.origin),
          brRefs: brRefs(ob.brRefs),
        })),
      ),
      stateMachines: DesignMachineDecls.of(
        (overrides.stateMachines ?? []).map((sm) => ({
          ...sm,
          id: DesignMachineId.reconstitute(sm.id),
          initial: InitialStates.of(sm.initial),
          transitions: DesignTransitionDecls.of(
            sm.transitions.map((tr) => ({ ...tr, id: DesignTransitionId.reconstitute(tr.id), brRefs: brRefs(tr.brRefs) })),
          ),
          ignores: DesignIgnoreDecls.of(sm.ignores),
        })),
      ),
      scenarios: DesignScenarioDecls.of(
        (overrides.scenarios ?? []).map((sc) => ({ ...sc, id: DesignScenarioId.reconstitute(sc.id), bindings: BindingPairs.of(sc.bindings), brRefs: brRefs(sc.brRefs) })),
      ),
      background: DesignBackgroundDecls.of(
        (overrides.background ?? []).map((bg) => ({ ...bg, id: DesignBackgroundId.reconstitute(bg.id) })),
      ),
      unformalizedTargets: UnformalizedTargets.of(overrides.unformalizedTargets ?? []),
      directoryExists: overrides.directoryExists ?? true,
      rulesMarkdown: overrides.rulesMarkdown ?? null,
    };
  }

  test("duplicate unit names are reported once per repeat", () => {
    expect(designWellFormednessErrors(DesignUnitDecls.of([unit({}), unit({})]))).toEqual(['duplicate unit "u1"']);
  });

  test("int attributes require bounds", () => {
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({ entities: [{ name: "t", attributes: [{ name: "age", kind: "int" }, { name: "age", kind: "int", min: 3, max: 1 }] }] }),
      ])),
    ).toEqual([
      "unit u1: t.age: int attributes require min and max — the Quint backend needs bounded domains",
      'unit u1: duplicate attribute "t.age"',
      "unit u1: t.age: min > max",
    ]);
  });

  test("an enum literal binds to its sibling ref, not to any enum in the unit", () => {
    const entities = [
      {
        name: "ticket",
        attributes: [
          { name: "status", kind: "enum", values: ["open"] },
          { name: "channel", kind: "enum", values: ["email"] },
          { name: "age", kind: "int", min: 0, max: 1 },
        ],
      },
    ];
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({
          entities,
          obligations: [
            {
              id: "DOB-1",
              assert: { op: "eq", args: [{ op: "ref", path: "ticket.status" }, { op: "enum", value: "email" }] },
            },
            {
              id: "DOB-2",
              assert: { op: "eq", args: [{ op: "ref", path: "ticket.age" }, { op: "enum", value: "email" }] },
            },
            { id: "DOB-3", assert: { op: "enum", value: "nope" } },
          ],
        }),
      ])),
    ).toEqual([
      'unit u1: obligation DOB-1: enum literal "email" is not a value of "ticket.status"',
      'unit u1: obligation DOB-2: enum literal "email" is compared against non-enum attribute "ticket.age"',
      'unit u1: obligation DOB-3: enum literal "nope" is not a value of any declared enum attribute',
    ]);
  });

  test("temporal branches are walked in design obligations too", () => {
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "flag", kind: "bool" }] }],
          obligations: [
            {
              id: "DOB-1",
              temporal: {
                assert: { op: "ref", path: "t.ghost" },
                from: { op: "ref", path: "t.flag" },
                to: { op: "ref", path: "t.other" },
              },
            },
          ],
        }),
      ])),
    ).toEqual([
      'unit u1: obligation DOB-1: unresolvable reference "t.ghost"',
      'unit u1: obligation DOB-1: unresolvable reference "t.other"',
    ]);
  });

  test("origin \"rules\" requires brRefs", () => {
    expect(designWellFormednessErrors(DesignUnitDecls.of([unit({ obligations: [{ id: "DOB-1", origin: "rules" }] })]))).toEqual([
      'unit u1: obligation DOB-1: origin "rules" requires brRefs',
    ]);
  });

  test("a machine's lifecycle attribute must be a declared enum", () => {
    expect(designWellFormednessErrors(DesignUnitDecls.of([unit({ stateMachines: [{ id: "SM-1", attrPath: "t.state", initial: [], transitions: [], ignores: [] }] })]))).toEqual([
      'unit u1: machine SM-1: lifecycle attribute "t.state" is not declared',
    ]);
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "state", kind: "bool" }] }],
          stateMachines: [{ id: "SM-1", attrPath: "t.state", initial: [], transitions: [], ignores: [] }],
        }),
      ])),
    ).toEqual(['unit u1: machine SM-1: lifecycle attribute "t.state" is not an enum — its values are the state set']);
  });

  test("machine states, self-assignment and ignore collisions", () => {
    const errors = designWellFormednessErrors(DesignUnitDecls.of([
      unit({
        entities: [{ name: "t", attributes: [{ name: "state", kind: "enum", values: ["open", "closed"] }] }],
        stateMachines: [
          {
            id: "SM-1",
            attrPath: "t.state",
            initial: ["ghost"],
            transitions: [
              {
                id: "TR-1",
                from: "open",
                to: "gone",
                trigger: "close",
                guard: { op: "ref", path: "t.state" },
                effect: { op: "ref", path: "t.state", prime: true },
              },
            ],
            ignores: [
              { state: "open", trigger: "close" },
              { state: "ghost", trigger: "x" },
            ],
          },
        ],
      }),
    ]));
    expect(errors).toEqual([
      'unit u1: machine SM-1: initial state "ghost" is not a value of t.state',
      'unit u1: transition TR-1: to state "gone" is not a value of t.state',
      `unit u1: transition TR-1: the effect assigns the machine's own attribute "t.state" — state' = to is implicit`,
      'unit u1: machine SM-1: ignores (open, close) collides with a declared transition for the same (state, trigger)',
      'unit u1: machine SM-1: ignores state "ghost" is not a value of t.state',
    ]);
  });

  test("scenario bindings and background assertions are checked per unit", () => {
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "flag", kind: "bool" }] }],
          scenarios: [
            {
              id: "DSC-1",
              bindings: [
                ["t.flag", 1],
                ["t.ghost", true],
              ],
              hasEvent: false,
              expect: { op: "ref", path: "t.flag", prime: true },
            },
          ],
          background: [{ id: "DBG-1", assert: { op: "ref", path: "t.ghost" } }],
        }),
      ])),
    ).toEqual([
      'unit u1: scenario DSC-1: binding value 1 does not fit bool attribute "t.flag"',
      'unit u1: scenario DSC-1: binding for unknown attribute "t.ghost"',
      'unit u1: scenario DSC-1: primed reference "t.flag" is only legal in effects and event-scenario expectations',
      'unit u1: background DBG-1: unresolvable reference "t.ghost"',
    ]);
  });

  test("a missing construction directory is an error even with zero brRefs", () => {
    expect(designWellFormednessErrors(DesignUnitDecls.of([unit({ directoryExists: false })]))).toEqual([
      "unit u1: no construction/u1/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified",
    ]);
  });

  test("brRefs without rules.md cannot be reverse-verified", () => {
    expect(designWellFormednessErrors(DesignUnitDecls.of([unit({ obligations: [{ id: "DOB-1", brRefs: ["BR1.1"] }] })]))).toEqual([
      "unit u1: brRefs are used but construction/u1/functional-design/rules.md was not found — they cannot be reverse-verified",
    ]);
  });

  test("BR coverage: unknown refs are errors and silent rules are a contract violation", () => {
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({
          obligations: [{ id: "DOB-1", brRefs: ["BR9.9"] }],
          unformalizedTargets: ["BR1.2"],
          rulesMarkdown: "- BR1.1\n- BR1.2\n",
        }),
      ])),
    ).toEqual([
      'unit u1: brRef "BR9.9" does not exist in rules.md',
      "unit u1: BR coverage: rule BR1.1 in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation",
    ]);
  });

  test("brRefs from transitions and scenarios count toward coverage", () => {
    expect(
      designWellFormednessErrors(DesignUnitDecls.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "state", kind: "enum", values: ["open"] }] }],
          stateMachines: [
            { id: "SM-1", attrPath: "t.state", initial: ["open"], transitions: [{ id: "TR-1", brRefs: ["BR1.1"] }], ignores: [] },
          ],
          scenarios: [{ id: "DSC-1", bindings: [], hasEvent: false, brRefs: ["BR1.2"] }],
          rulesMarkdown: "- BR1.1\n- BR1.2\n",
        }),
      ])),
    ).toEqual([]);
  });
});

describe("design decl collections (first-class operations)", () => {
  test("of/add/iterator/toArray hold insertion order across the decl bundle", () => {
    const values = DeclaredValues.of(["a"]).add("b");
    expect([...values]).toEqual(["a", "b"]);
    expect(values.includes("b")).toBe(true);
    expect(values.includes("c")).toBe(false);
    expect(values.toArray()).toEqual(["a", "b"]);

    const refs = BrRefs.of(["BR1.1"]).add("BR1.2");
    expect([...refs]).toEqual(["BR1.1", "BR1.2"]);
    expect(refs.toArray()).toEqual(["BR1.1", "BR1.2"]);

    const initial = InitialStates.of(["open"]).add("closed");
    expect([...initial]).toEqual(["open", "closed"]);
    expect(initial.toArray()).toEqual(["open", "closed"]);

    const unformalized = UnformalizedTargets.of(["BR2.1"]).add("BR2.2");
    expect([...unformalized]).toEqual(["BR2.1", "BR2.2"]);
    expect(unformalized.covers("BR2.2")).toBe(true);
    expect(unformalized.covers("BR9.9")).toBe(false);
    expect(unformalized.toArray()).toEqual(["BR2.1", "BR2.2"]);

    const bindings = BindingPairs.of([["t.flag", true]]).add(["t.n", 1]);
    expect([...bindings]).toEqual([
      ["t.flag", true],
      ["t.n", 1],
    ]);
    expect(bindings.toArray().length).toBe(2);

    const attr = { name: DesignAttributeName.reconstitute("state"), kind: "enum", values: DeclaredValues.of(["open"]) };
    const attrs = DesignAttributeDecls.of([]).add(attr);
    expect([...attrs]).toEqual([attr]);
    expect(attrs.toArray()).toEqual([attr]);

    const entity = { name: DesignEntityName.reconstitute("t"), attributes: attrs };
    const entities = DesignEntityDecls.of([]).add(entity);
    expect([...entities]).toEqual([entity]);
    expect(entities.toArray()).toEqual([entity]);

    const ob = { id: DesignObligationId.reconstitute("DOB-1") };
    const obs = DesignObligationDecls.of([]).add(ob);
    expect([...obs]).toEqual([ob]);
    expect(obs.toArray()).toEqual([ob]);

    const tr = { id: DesignTransitionId.reconstitute("TR-1") };
    const trs = DesignTransitionDecls.of([]).add(tr);
    expect([...trs]).toEqual([tr]);
    expect(trs.toArray()).toEqual([tr]);

    const ig = { state: "open", trigger: "close" };
    const igs = DesignIgnoreDecls.of([]).add(ig);
    expect([...igs]).toEqual([ig]);
    expect(igs.toArray()).toEqual([ig]);

    const sm = { id: DesignMachineId.reconstitute("SM-1"), attrPath: "t.state", initial, transitions: trs, ignores: igs };
    const sms = DesignMachineDecls.of([]).add(sm);
    expect([...sms]).toEqual([sm]);
    expect(sms.toArray()).toEqual([sm]);

    const sc = { id: DesignScenarioId.reconstitute("DSC-1"), bindings, hasEvent: false };
    const scs = DesignScenarioDecls.of([]).add(sc);
    expect([...scs]).toEqual([sc]);
    expect(scs.toArray()).toEqual([sc]);

    const bg = { id: DesignBackgroundId.reconstitute("DBG-1") };
    const bgs = DesignBackgroundDecls.of([]).add(bg);
    expect([...bgs]).toEqual([bg]);
    expect(bgs.toArray()).toEqual([bg]);

    const ud: DesignUnitDecl = {
      unit: DesignUnitId.of("u1"),
      entities,
      obligations: obs,
      stateMachines: sms,
      scenarios: scs,
      background: bgs,
      unformalizedTargets: unformalized,
      directoryExists: true,
      rulesMarkdown: null,
    };
    const uds = DesignUnitDecls.of([]).add(ud);
    expect([...uds]).toEqual([ud]);
    expect(uds.toArray()).toEqual([ud]);
  });
});

describe("contract-1 decl collections (first-class operations)", () => {
  test("of/add/iterator/toArray hold declaration order across the Ir bundle", () => {
    const values = IrDeclaredValues.of(["a"]).add("b");
    expect([...values]).toEqual(["a", "b"]);
    expect(values.includes("b")).toBe(true);
    expect(values.includes("z")).toBe(false);
    expect(values.toArray()).toEqual(["a", "b"]);

    const attr = { name: IrAttributeName.reconstitute("x"), kind: "bool" };
    const attrs = IrAttributeDecls.of([]).add(attr);
    expect([...attrs]).toEqual([attr]);
    expect(attrs.toArray()).toEqual([attr]);

    const ent = { name: IrEntityName.reconstitute("t"), attributes: attrs };
    const ents = IrEntityDecls.of([]).add(ent);
    expect([...ents]).toEqual([ent]);
    expect(ents.toArray()).toEqual([ent]);

    const ob = { id: ObligationId.reconstitute("OB-1") };
    const obs = IrObligationDecls.of([]).add(ob);
    expect([...obs]).toEqual([ob]);
    expect(obs.toArray()).toEqual([ob]);

    const pairs = IrBindingPairs.of([["t.x", true]]).add(["t.y", 1]);
    expect([...pairs]).toEqual([
      ["t.x", true],
      ["t.y", 1],
    ]);
    expect(pairs.toArray().length).toBe(2);

    const sc = { id: ScenarioId.reconstitute("SC-1"), bindings: pairs, hasEvent: false };
    const scs = IrScenarioDecls.of([]).add(sc);
    expect([...scs]).toEqual([sc]);
    expect(scs.toArray()).toEqual([sc]);

    const bg = { id: BackgroundAssumptionId.reconstitute("BG-1") };
    const bgs = IrBackgroundDecls.of([]).add(bg);
    expect([...bgs]).toEqual([bg]);
    expect(bgs.toArray()).toEqual([bg]);
  });
});

describe("decl name primitives and the shared bound (issue #46 wave 5c-2)", () => {
  test("IrEntityName / IrAttributeName parse-reject the empty token and rehydrate verbatim", () => {
    expect(IrEntityName.parse("").ok).toBe(false);
    const en = IrEntityName.parse("order");
    if (!en.ok) throw new Error("unreachable");
    expect(en.value.equals(IrEntityName.reconstitute("order"))).toBe(true);
    expect(en.value.asString()).toBe("order");

    expect(IrAttributeName.parse("").ok).toBe(false);
    const an = IrAttributeName.parse("qty");
    if (!an.ok) throw new Error("unreachable");
    expect(an.value.equals(IrAttributeName.reconstitute("qty"))).toBe(true);
    expect(an.value.asString()).toBe("qty");
  });

  test("AttributeBound owns the range-inversion comparison", () => {
    expect(AttributeBound.reconstitute(9).exceeds(AttributeBound.reconstitute(1))).toBe(true);
    expect(AttributeBound.reconstitute(1).exceeds(AttributeBound.reconstitute(1))).toBe(false);
  });
});

describe("materials aggregates and the persistence round-trip (repository ruling)", () => {
  test("ErrorMessages first-class collection", () => {
    const msgs = ErrorMessages.of(["a"]).add("b");
    expect([...msgs]).toEqual(["a", "b"]);
    expect(msgs.isEmpty()).toBe(false);
    expect(ErrorMessages.of([]).isEmpty()).toBe(true);
    expect(msgs.toArray()).toEqual(["a", "b"]);
  });

  test("IrValidationMaterialsId / DesignIrValidationMaterialsId anchor 1:1 to the model id", () => {
    const rid = IrValidationMaterialsId.ofModel(FormalModelId.of(ap("/r/x.md")));
    expect(rid.equals(IrValidationMaterialsId.ofModel(FormalModelId.of(ap("/r/x.md"))))).toBe(true);
    expect(rid.modelId().artifactPath().asString()).toBe("/r/x.md");
    const did = DesignIrValidationMaterialsId.ofModel(DesignModelId.of(ap("/r/y.md")));
    expect(did.equals(DesignIrValidationMaterialsId.ofModel(DesignModelId.of(ap("/r/y.md"))))).toBe(true);
    expect(did.modelId().artifactPath().asString()).toBe("/r/y.md");
  });

  test("findById∘store round-trips the source document byte-for-byte (both contracts)", () => {
    const record = join(tmpdir(), `deep-spec-store-${Math.random().toString(36).slice(2)}`);
    const stage = join(record, "construction", "deep-spec-analysis-verify");
    mkdirSync(stage, { recursive: true });
    const irDoc = '# model\n\n```json\n{"irVersion":"1.0.0","entities":[],"obligations":[],"scenarios":[]}\n```\n';
    const modelPath = join(stage, "deep-spec-analysis-formal-model.md");
    writeFileSync(modelPath, irDoc);
    const repo = new IrValidationMaterialsRepositoryImpl({ schemaPath: irSchemaPath });
    const found = repo.findById(IrValidationMaterialsId.ofModel(FormalModelId.of(ap(modelPath))));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.sourceDocument()).toBe(irDoc);
    rmSync(modelPath);
    const stored = repo.store(found.value);
    expect(stored.ok).toBe(true);
    expect(readFileSync(modelPath, "utf-8")).toBe(irDoc);
    expect(found.value.irVersion().asString()).toBe("1.0.0");
    expect(Array.isArray(found.value.schemaErrors().toArray())).toBe(true);
    expect(found.value.frReferenceIndex()).toBeDefined();

    // design 側も同じ往復則。
    const dDoc = '# design\n\n```json\n{"irVersion":"1.0.0","units":[]}\n```\n';
    const dPath = join(stage, "deep-spec-analysis-functional-formal-model.md");
    writeFileSync(dPath, dDoc);
    const dRepo = new DesignIrValidationMaterialsRepositoryImpl({ schemaPath: designSchemaPath });
    const dId = DesignIrValidationMaterialsId.ofModel(DesignModelId.of(ap(dPath)));
    const dFound = dRepo.findById(dId);
    expect(dFound.ok).toBe(true);
    if (!dFound.ok) return;
    expect(dFound.value.id().equals(dId)).toBe(true);
    expect(dFound.value.sourceDocument()).toBe(dDoc);
    rmSync(dPath);
    expect(dRepo.store(dFound.value).ok).toBe(true);
    expect(readFileSync(dPath, "utf-8")).toBe(dDoc);
    rmSync(record, { recursive: true, force: true });
  });

  test("FrRefClaims first-class collection feeds the reverse index", () => {
    const claims = FrRefClaims.of([]).add({ owner: "OB-1", frRefs: FrRefs.of(["FR-1"]) });
    expect([...claims].length).toBe(1);
    expect(claims.toArray()[0]?.owner).toBe("OB-1");
  });
});

describe("repository read failures keep the Result contract (PR#58 review)", () => {
  test("a directory squatting on the artifact path classifies as io-failed, not a crash", () => {
    const record = join(tmpdir(), `deep-spec-iofail-${Math.random().toString(36).slice(2)}`);
    const stage = join(record, "construction", "deep-spec-analysis-verify");
    // 成果物名のディレクトリ: existsSync は真だが readFileSync は EISDIR。
    mkdirSync(join(stage, "deep-spec-analysis-formal-model.md"), { recursive: true });
    const found = new IrValidationMaterialsRepositoryImpl({ schemaPath: irSchemaPath }).findById(
      IrValidationMaterialsId.ofModel(FormalModelId.of(ap(join(stage, "deep-spec-analysis-formal-model.md")))),
    );
    expect(!found.ok && found.error.kind).toBe("io-failed");

    mkdirSync(join(stage, "deep-spec-analysis-functional-formal-model.md"), { recursive: true });
    const dFound = new DesignIrValidationMaterialsRepositoryImpl({ schemaPath: designSchemaPath }).findById(
      DesignIrValidationMaterialsId.ofModel(DesignModelId.of(ap(join(stage, "deep-spec-analysis-functional-formal-model.md")))),
    );
    expect(!dFound.ok && dFound.error.kind).toBe("io-failed");
    rmSync(record, { recursive: true, force: true });
  });

  test("a directory squatting on requirements.md classifies as io-failed", () => {
    const record = join(tmpdir(), `deep-spec-src-iofail-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "inception", "requirements-analysis", "requirements.md"), { recursive: true });
    const source = new RequirementsSourceRepositoryImpl().findById(RequirementsSourceId.of(ap(record)));
    expect(!source.ok && source.error.kind).toBe("io-failed");
    rmSync(record, { recursive: true, force: true });
  });
});

describe("store faces on the workflow-authored aggregates (owner ruling: writable where writing is definable)", () => {
  test("formal/design model repositories round-trip the source document", () => {
    const record = join(tmpdir(), `deep-spec-model-store-${Math.random().toString(36).slice(2)}`);
    mkdirSync(record, { recursive: true });
    const doc = '# m\n\n```json\n{"irVersion":"1.0.0","schema":{"entities":[]},"obligations":[],"scenarios":[]}\n```\n';
    const mPath = join(record, "deep-spec-analysis-formal-model.md");
    writeFileSync(mPath, doc);
    const repo = new FormalModelRepositoryImpl();
    const found = repo.findById(FormalModelId.of(ap(mPath)));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.sourceDocument()).toBe(doc);
    rmSync(mPath);
    expect(repo.store(found.value).ok).toBe(true);
    expect(readFileSync(mPath, "utf-8")).toBe(doc);

    // 実 fixture の設計 IR を往復させる（合成文書はパーサの構造要件に届かない）。
    const dDoc = readFileSync(
      join(pluginRoot, "tests", "fixtures", "design", "record", "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"),
      "utf-8",
    );
    const dPath = join(record, "deep-spec-analysis-functional-formal-model.md");
    writeFileSync(dPath, dDoc);
    const dRepo = new DesignModelRepositoryImpl();
    const dFound = dRepo.findById(DesignModelId.of(ap(dPath)));
    expect(dFound.ok).toBe(true);
    if (!dFound.ok) return;
    rmSync(dPath);
    expect(dRepo.store(dFound.value).ok).toBe(true);
    expect(readFileSync(dPath, "utf-8")).toBe(dDoc);
    rmSync(record, { recursive: true, force: true });
  });

  test("requirements source repository round-trips the source bytes at the resolved location", () => {
    const record = join(tmpdir(), `deep-spec-src-store-${Math.random().toString(36).slice(2)}`);
    const srcPath = join(record, "inception", "requirements-analysis", "requirements.md");
    mkdirSync(dirname(srcPath), { recursive: true });
    writeFileSync(srcPath, "- FR-1: x\n");
    const repo = new RequirementsSourceRepositoryImpl();
    const found = repo.findById(RequirementsSourceId.of(ap(record)));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.sourcePath.asString()).toBe(srcPath);
    rmSync(srcPath);
    expect(repo.store(found.value).ok).toBe(true);
    expect(readFileSync(srcPath, "utf-8")).toBe("- FR-1: x\n");
    rmSync(record, { recursive: true, force: true });
  });
});
