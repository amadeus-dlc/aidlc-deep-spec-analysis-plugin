// 契約1／契約3 の IR バリデータを in-process で駆動するスイート（PR7）。
//
// 主証拠は「子プロセスで実センサーを撃った verdict 行」と「同じ入力を
// in-process のインタラクタ＋実 Impl で処理した結果」のバイト一致。両者が
// 一致する限り、well-formedness の移設は観測面を動かしていない。
// 併せて、子プロセス経由では in-process 計測に乗らないドメインの分岐を
// 直接叩く（domain 層 90% 床の担保）。

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DesignIrValidationMaterialsRepositoryImpl } from "../tools/design/adapter/index.ts";
import {
  BrReferenceIndex,
  type DesignUnitView,
  designWellFormednessErrors,
} from "../tools/design/domain/index.ts";
import { ValidateDesignIrUseCase, type ValidateDesignIrOutcome } from "../tools/design/usecase/index.ts";
import {
  IrValidationMaterialsRepositoryImpl,
  RequirementsSourceRepositoryImpl,
} from "../tools/requirements/adapter/index.ts";
import {
  FrReferenceIndex,
  type IrModelView,
  SourceAnchor,
  modelWellFormednessErrors,
} from "../tools/requirements/domain/index.ts";
import { ValidateIrUseCase, type ValidateIrOutcome } from "../tools/requirements/usecase/index.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures");
const irSchemaPath = join(toolsDir, "data", "deep-spec-ir-schema.json");
const designSchemaPath = join(toolsDir, "data", "deep-spec-design-ir-schema.json");

const MAX_REPORTED_ERRORS = 25;

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
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("broken fixture — semantic defects and frRef traceability", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "invalid", "deep-spec-analysis-formal-model.md"));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).pass).toBe(false);
  });

  test("drifted requirements — sourceDigest mismatch", () => {
    const { record, modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const req = join(record, "inception", "requirements-analysis", "requirements.md");
    writeFileSync(req, `${readFileSync(req, "utf-8")}\n- FR-9: 監査ログを5年間保持しなければならない。\n`);
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors.join("\n")).toContain("does not match requirements.md");
  });

  test("missing sourceDigest — the value to add is handed back", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace(/^\s*"sourceDigest": "[0-9a-f]{64}",\n/m, ""));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors.join("\n")).toContain('add "sourceDigest"');
  });

  test("requirements.md absent — frRefs cannot be reverse-verified", () => {
    const record = join(tmpdir(), `deep-spec-ir-valid-noreq-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
    const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
    cpSync(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"), modelPath);
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors).toContain(
      "requirements.md not found under this intent record — frRefs cannot be reverse-verified",
    );
  });

  test("fence and JSON failures short-circuit before the version check", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, "# no fence here\n");
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath));

    writeFileSync(modelPath, "```json\n{ not json\n```\n");
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath));

    writeFileSync(modelPath, "```json\n[]\n```\n");
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath));
  });

  test("schema absent — the acquisition fails before anything else", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const useCase = new ValidateIrUseCase(
      new IrValidationMaterialsRepositoryImpl({ schemaPath: join(tmpdir(), "no-such-ir-schema.json") }),
      new RequirementsSourceRepositoryImpl(),
    );
    const outcome = useCase.execute(modelPath);
    expect(outcome.kind).toBe("verdict");
    if (outcome.kind !== "verdict") return;
    expect(outcome.pass).toBe(false);
    expect(outcome.errors[0]).toContain("IR schema not installed at");
  });

  test("unsupported major version is reported before the schema errors", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace(/"irVersion": "1\.[0-9]+\.[0-9]+"/, '"irVersion": "2.0.0"'));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors[0]).toContain("unsupported major version");
  });

  test("a write that is not the formal model is not applicable", () => {
    const { record } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const other = join(record, "inception", "deep-spec-analysis-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    expect(irUseCase().execute(other).kind).toBe("not-applicable");
    expect(renderVerdict(irUseCase().execute(other))).toBe(fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, other));
  });
});

describe("ValidateDesignIrUseCase reproduces the design-ir-valid sensor byte-for-byte", () => {
  const stage = "deep-spec-analysis-functional-verify";

  test("canonical fixture", () => {
    const { modelPath } = makeDesignRecord();
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("invalid fixture — every planted defect, in the frozen order", () => {
    const { modelPath } = makeDesignRecord();
    cpSync(join(fixtures, "design", "invalid-formal-model.md"), modelPath);
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(modelPath))).toBe(viaSensor);
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
    expect(renderVerdict(designUseCase().execute(modelPath))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n{ not json\n```\n");
    expect(renderVerdict(designUseCase().execute(modelPath))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n[]\n```\n");
    expect(renderVerdict(designUseCase().execute(modelPath))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );
  });

  test("schema absent — the acquisition fails before anything else", () => {
    const { modelPath } = makeDesignRecord();
    const useCase = new ValidateDesignIrUseCase(
      new DesignIrValidationMaterialsRepositoryImpl({ schemaPath: join(tmpdir(), "no-such-design-schema.json") }),
    );
    const outcome = useCase.execute(modelPath);
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
    expect(renderVerdict(designUseCase().execute(modelPath))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors[0]).toContain("unsupported major version");
  });

  test("a write that is not the functional formal model is not applicable", () => {
    const { record } = makeDesignRecord();
    const other = join(record, "construction", "deep-spec-analysis-functional-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    expect(designUseCase().execute(other).kind).toBe("not-applicable");
  });
});

describe("FrReferenceIndex", () => {
  test("collects owners per frRef and reports the missing ones sorted", () => {
    const index = FrReferenceIndex.of([
      { owner: "OB-2", frRefs: ["FR-1", "FR-9"] },
      { owner: "OB-1", frRefs: ["FR-9"] },
      { owner: "scenarios[3]", frRefs: [] },
    ]);
    expect(index.referencedIds().sort()).toEqual(["FR-1", "FR-9"]);
    expect(index.missingErrors(new Set(["FR-1"]))).toEqual([
      'frRef "FR-9" (used by OB-1, OB-2) does not exist in requirements.md',
    ]);
    expect(index.missingErrors(new Set(["FR-1", "FR-9"]))).toEqual([]);
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
  const emptyView: IrModelView = { entities: [], obligations: [], scenarios: [], background: [] };

  test("a well-formed model is silent", () => {
    expect(
      modelWellFormednessErrors({
        ...emptyView,
        entities: [{ name: "order", attributes: [{ name: "qty", kind: "int", min: 0, max: 5 }] }],
        obligations: [{ id: "OB-1", assert: { op: "ref", path: "order.qty" } }],
      }),
    ).toEqual([]);
  });

  test("duplicate entities and attributes, and an inverted int range", () => {
    expect(
      modelWellFormednessErrors({
        ...emptyView,
        entities: [
          { name: "order", attributes: [{ name: "qty", kind: "int", min: 9, max: 1 }, { name: "qty", kind: "bool" }] },
          { name: "order", attributes: [] },
        ],
      }),
    ).toEqual([
      "schema: order.qty: min > max",
      'schema: duplicate attribute "order.qty"',
      'schema: duplicate entity "order"',
    ]);
  });

  test("unresolvable references, illegal primes and unknown enum literals", () => {
    expect(
      modelWellFormednessErrors({
        ...emptyView,
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
      }),
    ).toEqual([
      'obligation OB-1: unresolvable reference "order.total"',
      'obligation OB-1: primed reference "order.status" is only legal in event effects and event-scenario expectations',
      'obligation OB-1: enum literal "closed" is not a value of any declared enum attribute',
    ]);
  });

  test("primes are legal inside an effect, and temporal branches are walked", () => {
    expect(
      modelWellFormednessErrors({
        ...emptyView,
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
      }),
    ).toEqual(['obligation OB-1: unresolvable reference "order.ghost"']);
  });

  test("duplicate ids are reported across obligations, scenarios and background", () => {
    expect(
      modelWellFormednessErrors({
        ...emptyView,
        obligations: [{ id: "X-1" }],
        scenarios: [{ id: "X-1", bindings: [], hasEvent: false }],
        background: [{ id: "X-1" }],
      }),
    ).toEqual([
      'scenario X-1: duplicate id "X-1"',
      'background X-1: duplicate id "X-1"',
    ]);
  });

  test("scenario bindings are typed against the attribute catalogue", () => {
    expect(
      modelWellFormednessErrors({
        ...emptyView,
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
      }),
    ).toEqual([
      'scenario SC-1: binding value 1.5 does not fit int attribute "order.qty"',
      'scenario SC-1: binding value "closed" does not fit enum attribute "order.status"',
      'scenario SC-1: binding for unknown attribute "order.ghost"',
    ]);
  });

  test("background assertions are walked", () => {
    expect(
      modelWellFormednessErrors({ ...emptyView, background: [{ id: "BG-1", assert: { op: "ref", path: "a.b" } }] }),
    ).toEqual(['background BG-1: unresolvable reference "a.b"']);
  });
});

describe("designWellFormednessErrors (contract 3 domain branches)", () => {
  function unit(overrides: Partial<DesignUnitView>): DesignUnitView {
    return {
      unit: "u1",
      entities: [],
      obligations: [],
      stateMachines: [],
      scenarios: [],
      background: [],
      unformalizedTargets: [],
      directoryExists: true,
      rulesMarkdown: null,
      ...overrides,
    };
  }

  test("duplicate unit names are reported once per repeat", () => {
    expect(designWellFormednessErrors([unit({}), unit({})])).toEqual(['duplicate unit "u1"']);
  });

  test("int attributes require bounds", () => {
    expect(
      designWellFormednessErrors([
        unit({ entities: [{ name: "t", attributes: [{ name: "age", kind: "int" }, { name: "age", kind: "int", min: 3, max: 1 }] }] }),
      ]),
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
      designWellFormednessErrors([
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
      ]),
    ).toEqual([
      'unit u1: obligation DOB-1: enum literal "email" is not a value of "ticket.status"',
      'unit u1: obligation DOB-2: enum literal "email" is compared against non-enum attribute "ticket.age"',
      'unit u1: obligation DOB-3: enum literal "nope" is not a value of any declared enum attribute',
    ]);
  });

  test("temporal branches are walked in design obligations too", () => {
    expect(
      designWellFormednessErrors([
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
      ]),
    ).toEqual([
      'unit u1: obligation DOB-1: unresolvable reference "t.ghost"',
      'unit u1: obligation DOB-1: unresolvable reference "t.other"',
    ]);
  });

  test("origin \"rules\" requires brRefs", () => {
    expect(designWellFormednessErrors([unit({ obligations: [{ id: "DOB-1", origin: "rules" }] })])).toEqual([
      'unit u1: obligation DOB-1: origin "rules" requires brRefs',
    ]);
  });

  test("a machine's lifecycle attribute must be a declared enum", () => {
    expect(designWellFormednessErrors([unit({ stateMachines: [{ id: "SM-1", attrPath: "t.state", initial: [], transitions: [], ignores: [] }] })])).toEqual([
      'unit u1: machine SM-1: lifecycle attribute "t.state" is not declared',
    ]);
    expect(
      designWellFormednessErrors([
        unit({
          entities: [{ name: "t", attributes: [{ name: "state", kind: "bool" }] }],
          stateMachines: [{ id: "SM-1", attrPath: "t.state", initial: [], transitions: [], ignores: [] }],
        }),
      ]),
    ).toEqual(['unit u1: machine SM-1: lifecycle attribute "t.state" is not an enum — its values are the state set']);
  });

  test("machine states, self-assignment and ignore collisions", () => {
    const errors = designWellFormednessErrors([
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
    ]);
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
      designWellFormednessErrors([
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
      ]),
    ).toEqual([
      'unit u1: scenario DSC-1: binding value 1 does not fit bool attribute "t.flag"',
      'unit u1: scenario DSC-1: binding for unknown attribute "t.ghost"',
      'unit u1: scenario DSC-1: primed reference "t.flag" is only legal in effects and event-scenario expectations',
      'unit u1: background DBG-1: unresolvable reference "t.ghost"',
    ]);
  });

  test("a missing construction directory is an error even with zero brRefs", () => {
    expect(designWellFormednessErrors([unit({ directoryExists: false })])).toEqual([
      "unit u1: no construction/u1/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified",
    ]);
  });

  test("brRefs without rules.md cannot be reverse-verified", () => {
    expect(designWellFormednessErrors([unit({ obligations: [{ id: "DOB-1", brRefs: ["BR1.1"] }] })])).toEqual([
      "unit u1: brRefs are used but construction/u1/functional-design/rules.md was not found — they cannot be reverse-verified",
    ]);
  });

  test("BR coverage: unknown refs are errors and silent rules are a contract violation", () => {
    expect(
      designWellFormednessErrors([
        unit({
          obligations: [{ id: "DOB-1", brRefs: ["BR9.9"] }],
          unformalizedTargets: ["BR1.2"],
          rulesMarkdown: "- BR1.1\n- BR1.2\n",
        }),
      ]),
    ).toEqual([
      'unit u1: brRef "BR9.9" does not exist in rules.md',
      "unit u1: BR coverage: rule BR1.1 in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation",
    ]);
  });

  test("brRefs from transitions and scenarios count toward coverage", () => {
    expect(
      designWellFormednessErrors([
        unit({
          entities: [{ name: "t", attributes: [{ name: "state", kind: "enum", values: ["open"] }] }],
          stateMachines: [
            { id: "SM-1", attrPath: "t.state", initial: ["open"], transitions: [{ id: "TR-1", brRefs: ["BR1.1"] }], ignores: [] },
          ],
          scenarios: [{ id: "DSC-1", bindings: [], hasEvent: false, brRefs: ["BR1.2"] }],
          rulesMarkdown: "- BR1.1\n- BR1.2\n",
        }),
      ]),
    ).toEqual([]);
  });
});
