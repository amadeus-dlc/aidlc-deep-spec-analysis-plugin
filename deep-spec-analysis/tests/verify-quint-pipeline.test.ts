// レイヤード verify-quint パイプラインの in-process 検証（PR4、#17）。
//
// 1) golden 同値：conformance fixture を tmp へ複製し、interactor 正形の
//    ユースケースを実 Impl（実 quint CLI・seeded simulation）で駆動して、
//    書かれた quint.json / cross-check.json を期待 golden とバイト比較する。
// 2) ドメイン検査の分岐固定：解釈・式評価・降格の各純関数を直接駆動する
//    （domain 90% 床）。
// 3) interactor のテスト容易性：InMemory ダブルと素の値だけで use case が
//    全経路を踏めることを証明する。

import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "../tools/kernel/adapter/index.ts";
import { TriggerName, TargetId, ContentHash, IrVersion, ArtifactPath, type Expression, KeyedIndex } from "../tools/kernel/domain/index.ts";
import { type Result, err, ok } from "../tools/kernel/infrastructure/index.ts";
import type { RepositoryError } from "../tools/kernel/usecase/index.ts";

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}
import {
  FormalModelRepositoryImpl,
  QuintClientImpl,
  VerificationReportRepositoryImpl,
  renderVerificationReportBytes,
} from "../tools/requirements/adapter/index.ts";
import { BackgroundAssumption, Scenario, Obligation, AttributeDeclaration, AttributeDeclarations, AttributeValues, FrRefs, ObligationId, ObligationNature, ScenarioId, Obligations, Scenarios, BackgroundAssumptions, RequirementsModel, QuintMachineComponents, QuintMachinePlan, QuintMachineComponent, QuintMachineRunVerdict, QuintRuns, QuintScenarioVerdict, QuintTemporalVerdict, TraceStates, VerificationReportId, VerificationSkips, FormalModelId, ObligationIds, VerificationSkipped, VerificationFinding, VerificationReport, AttributePath, TraceState, TraceValue } from "../tools/requirements/domain/index.ts";
import {
  type FormalModelRepository,
  type QuintCheckResult,
  type QuintClient,
  VerifyRequirementsQuintUseCase,
} from "../tools/requirements/usecase/index.ts";
import { InMemoryVerificationReportRepository } from "./doubles/in-memory-verification-report-repository.ts";

// テスト用: 平文の状態 → TraceState（裁定 2 で値オブジェクトになった）。
function st(values: { [path: string]: boolean | number | string }): TraceState {
  return TraceState.of(Object.entries(values).map(([path, value]) => [AttributePath.reconstitute(path), TraceValue.of(value)] as const));
}

// 判定レコードは class（#71 波18）——期待値は平文へ射影して比較する（bun の toEqual は #private を見ない）。
const plainFindings = (findings: Iterable<VerificationFinding>) =>
  [...findings].map((f) => ({ kind: f.kind(), frRefs: f.frRefs().toStrings(), targets: f.targets().toStrings(), witness: f.witness().toDocument(), detail: f.detail() }));


const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pluginRoot, "tests", "fixtures", "conformance");
const schemaPath = join(pluginRoot, "tools", "data", "deep-spec-findings-schema.json");
const schema = readContractSchema(schemaPath);

// テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
type RawAttributeDeclaration = Omit<Parameters<typeof AttributeDeclaration.reconstitute>[0], "values"> & { values?: string[] };
type RawObligation = Omit<Parameters<typeof Obligation.reconstitute>[0], "frRefs" | "trigger"> & { frRefs: string[]; trigger?: string };
type RawScenario = Omit<Parameters<typeof Scenario.reconstitute>[0], "frRefs"> & { frRefs: string[] };
function model(seed: {
  irVersion?: IrVersion;
  attributes?: RawAttributeDeclaration[];
  obligations?: RawObligation[];
  scenarios?: RawScenario[];
  background?: BackgroundAssumption[];
}): RequirementsModel {
  return RequirementsModel.reconstitute({
    id: FormalModelId.of(ap("/test/deep-spec-analysis-formal-model.md")),
    irHash: ContentHash.reconstitute(HASH),
    sourceDocument: new Uint8Array(),
    irVersion: seed.irVersion ?? IrVersion.reconstitute("1.0.0"),
    attributes: AttributeDeclarations.of(
      (seed.attributes ?? []).map((a) => AttributeDeclaration.reconstitute({ ...a, values: a.values === undefined ? undefined : AttributeValues.of(a.values) })),
    ),
    obligations: Obligations.of((seed.obligations ?? []).map((o) => Obligation.reconstitute({ ...o, frRefs: FrRefs.reconstitute(o.frRefs), trigger: o.trigger === undefined ? undefined : TriggerName.reconstitute(o.trigger) }))),
    scenarios: Scenarios.of((seed.scenarios ?? []).map((s) => Scenario.reconstitute({ ...s, frRefs: FrRefs.reconstitute(s.frRefs) }))),
    background: BackgroundAssumptions.of(seed.background ?? []),
  });
}

describe("in-process golden equivalence (interactor over real Impls, real quint CLI)", () => {
  test("the use case reproduces the golden quint.json and cross-check.json bytes", () => {
    const record = mkdtempSync(join(tmpdir(), "verify-quint-usecase-"));
    try {
      const modelPath = join(record, "deep-spec-analysis-formal-model.md");
      cpSync(join(fixtures, "deep-spec-analysis-formal-model.md"), modelPath);
      const verifyDir = join(record, "deep-spec-verify");
      mkdirSync(verifyDir, { recursive: true });
      // 兄弟バックエンド文書を golden から先置きして、クロスチェックの収束
      // （最後の書き手が全文書から再計算する）も同時に証明する。
      cpSync(join(fixtures, "expected", "smt.json"), join(verifyDir, "smt.json"));

      const outcome = new VerifyRequirementsQuintUseCase(
        new FormalModelRepositoryImpl(),
        new VerificationReportRepositoryImpl(schemaPath),
        new QuintClientImpl({
          quintBin: join(pluginRoot, "node_modules", ".bin", "quint"),
          methodOverride: "simulation",
          apalacheDistSet: false,
          homeDirectory: "",
        }),
      ).execute({ modelId: FormalModelId.of(ap(modelPath)), verifyDirectory: ap(verifyDir) });

      expect(outcome.kind).toBe("verified");
      expect(outcome.kind === "verified" && outcome.method).toBe("simulation");
      expect(readFileSync(join(verifyDir, "quint.json"), "utf-8"))
        .toBe(readFileSync(join(fixtures, "expected", "quint.json"), "utf-8"));
      expect(readFileSync(join(verifyDir, "cross-check.json"), "utf-8"))
        .toBe(readFileSync(join(fixtures, "expected", "cross-check.json"), "utf-8"));
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  }, 90_000);
});

// --- interactor の全経路（InMemory ダブル＋素の値のみ） ----------------------

function formalModels(result: Result<RequirementsModel, RepositoryError>): FormalModelRepository {
  return { findById: () => result, store: () => ok(undefined) };
}

function quint(result: QuintCheckResult): QuintClient {
  return { check: () => result };
}

// テスト用: 生 id の対 → DP キーの索引（裁定 3-1）。
function temporalsOf(entries: readonly (readonly [string, QuintTemporalVerdict])[]): KeyedIndex<ObligationId, QuintTemporalVerdict> {
  return KeyedIndex.of(entries.map(([id, v]) => [ObligationId.reconstitute(id), v] as const));
}
function scenariosOf(entries: readonly (readonly [string, QuintScenarioVerdict])[]): KeyedIndex<ScenarioId, QuintScenarioVerdict> {
  return KeyedIndex.of(entries.map(([id, v]) => [ScenarioId.reconstitute(id), v] as const));
}

const EMPTY_RUNS: Parameters<typeof QuintRuns.of>[0] = { machine: null, temporals: temporalsOf([]), scenarios: scenariosOf([]) };

const HASH = "a".repeat(64);

describe("the verify-quint interactor over the InMemory double", () => {
  const DIR = "/tmp/verify-quint";

  test("a corrupt model writes the simulation-method ir-unreadable degradation", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(err({ kind: "corrupt", path: "/x", cause: "IR is not a JSON object" })),
      reports,
      quint({ kind: "cli-unavailable" }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("model-unreadable");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "quint"));
    expect(written.ok && written.value.method()).toBe("simulation");
    expect(written.ok && written.value.unavailableReason())
      .toBe("IR unreadable: IR is not a JSON object — see the deep-spec-ir-valid sensor for details");
    expect(reports.findById(VerificationReportId.of(ap(DIR), "cross-check")).ok).toBe(false);
  });

  test("a missing quint CLI writes the frozen unavailable document and the caller exits 127", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const m = model({
      obligations: [{ id: ObligationId.reconstitute("OB-1"), nature: ObligationNature.reconstitute("invariant"), frRefs: [] }],
      scenarios: [{ id: ScenarioId.reconstitute("SC-1"), kind: "accept", frRefs: [], bindings: {} }],
    });
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(ok(m)),
      reports,
      quint({ kind: "cli-unavailable" }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("backend-unavailable");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "quint"));
    expect(written.ok && written.value.unavailableReason())
      .toBe("quint CLI is not available (install: npm i -g @informalsystems/quint)");
    expect(written.ok && written.value.method()).toBe("simulation");
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`))
      .toEqual(["OB-1:unavailable:quint CLI missing", "SC-1:unavailable:quint CLI missing"]);
    expect(reports.findById(VerificationReportId.of(ap(DIR), "cross-check")).ok).toBe(true);
  });

  test("an uncompilable machine records every target as compile-error under the detected method", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const m = model({
      obligations: [{ id: ObligationId.reconstitute("OB-1"), nature: ObligationNature.reconstitute("invariant"), frRefs: [] }],
      scenarios: [{ id: ScenarioId.reconstitute("SC-1"), kind: "accept", frRefs: [], bindings: {} }],
    });
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(ok(m)),
      reports,
      quint({ kind: "machine-uncompilable", method: "bounded", error: 'state variable name collision: "a_b"' }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("machine-uncompilable");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "quint"));
    expect(written.ok && written.value.method()).toBe("bounded");
    expect(written.ok && written.value.isUnavailable()).toBe(false);
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}`))
      .toEqual(["OB-1:compile-error", "SC-1:compile-error"]);
    expect(written.ok && written.value.skipped().toArray()[0]?.detail()).toBe('state variable name collision: "a_b"');
  });

  test("a checked run interprets, persists the conformed report, and reports the detected method", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const m = model({
      obligations: [{ id: ObligationId.reconstitute("OB-1"), nature: ObligationNature.reconstitute("invariant"), frRefs: ["FR-1"], assert: { op: "bool", value: true } }],
      scenarios: [{ id: ScenarioId.reconstitute("SC-1"), kind: "reject", frRefs: ["FR-2"], bindings: { "T.x": 1 } }],
    });
    const plan = QuintMachinePlan.of({
      invariantComponents: QuintMachineComponents.of([QuintMachineComponent.reconstitute({ id: ObligationId.reconstitute("OB-1"), expression: { op: "bool", value: true } })]),
      eventIds: ObligationIds.of([]),
      scenariosWithInit: [ScenarioId.reconstitute("SC-1")],
    });
    const runs = QuintRuns.of({
      machine: QuintMachineRunVerdict.clean(),
      temporals: temporalsOf([]),
      scenarios: scenariosOf([["SC-1", QuintScenarioVerdict.evaluated(false)]]),
    });
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(ok(m)),
      reports,
      quint({ kind: "checked", method: "bounded", plan, compileSkips: VerificationSkips.of([]), runs }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("verified");
    expect(outcome.kind === "verified" && outcome.pass).toBe(false);
    expect(outcome.kind === "verified" && outcome.method).toBe("bounded");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "quint"));
    expect(written.ok && written.value.findings().toArray()[0]?.kind()).toBe("scenario-violation");
    const bytes = written.ok ? renderVerificationReportBytes(written.value) : "";
    expect(JSON.parse(bytes).method).toBe("bounded");
    expect(Object.keys(JSON.parse(bytes))).toEqual(["backend", "irVersion", "irHash", "method", "findings", "skipped"]);
  });
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

describe("quint verdict interpretation", () => {
  const machineModel = model({
    obligations: [
      { id: ObligationId.reconstitute("OB-1"), nature: ObligationNature.reconstitute("invariant"), frRefs: ["FR-1"], assert: { op: "ref", path: "T.ok" } },
      { id: ObligationId.reconstitute("OB-2"), nature: ObligationNature.reconstitute("event"), frRefs: ["FR-2"] },
      { id: ObligationId.reconstitute("OB-3"), nature: ObligationNature.reconstitute("state-temporal"), frRefs: ["FR-3"], temporal: { pattern: "leads-to" } },
    ],
    scenarios: [
      { id: ScenarioId.reconstitute("SC-1"), kind: "accept", frRefs: ["FR-1"], bindings: { "T.ok": false } },
      { id: ScenarioId.reconstitute("SC-2"), kind: "reject", frRefs: ["FR-2"], bindings: { "T.ok": true } },
      { id: ScenarioId.reconstitute("SC-3"), kind: "accept", frRefs: [], bindings: {}, event: { trigger: TriggerName.reconstitute("go") } },
    ],
  });
  const plan = QuintMachinePlan.of({
    invariantComponents: QuintMachineComponents.of([QuintMachineComponent.reconstitute({ id: ObligationId.reconstitute("OB-1"), expression: { op: "ref", path: "T.ok" } })]),
    eventIds: ObligationIds.of([ObligationId.reconstitute("OB-2")]),
    scenariosWithInit: [ScenarioId.reconstitute("SC-1"), ScenarioId.reconstitute("SC-2")],
  });
  const run = (runs: Partial<Parameters<typeof QuintRuns.of>[0]>, method = "simulation", compileSkips: { target: string; reason: string }[] = []) =>
    plan.interpret(machineModel, VerificationSkips.of(compileSkips.map((k) => VerificationSkipped.reconstitute({ target: TargetId.reconstitute(k.target), reason: k.reason }))), method, QuintRuns.of({ ...EMPTY_RUNS, ...runs }));

  test("a machine timeout skips every machine target with the frozen budget wording", () => {
    const { skipped } = run({ machine: QuintMachineRunVerdict.timeout() });
    expect(skipped.toArray().filter((s) => s.reason() === "timeout").map((s) => `${s.target().asString()}:${s.detail()}`)).toEqual([
      "OB-1:machine invariant check exceeded its budget",
      "OB-2:machine invariant check exceeded its budget",
    ]);
  });

  test("a deadlock is a completeness-gap over the event ids, with a model fallback witness", () => {
    const withTrace = run({ machine: QuintMachineRunVerdict.deadlock(TraceStates.of([st({ "T.ok": true })])) });
    expect(plainFindings([...withTrace.findings])).toEqual([{
      kind: "completeness-gap",
      frRefs: (["FR-2"]),
      targets: (["OB-2"]),
      witness: { trace: [{ "T.ok": true }] },
      detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
    }]);
    const noTrace = run({ machine: QuintMachineRunVerdict.deadlock(null) });
    expect(noTrace.findings.toArray()[0]?.witness().toDocument()).toEqual({ model: {} });
  });

  test("a violation trace is attributed to the failing components via pure evaluation", () => {
    const attributed = run({ machine: QuintMachineRunVerdict.violation(TraceStates.of([st({ "T.ok": true }), st({ "T.ok": false })])) });
    expect(plainFindings([...attributed.findings])).toEqual([{
      kind: "conflict",
      frRefs: (["FR-1", "FR-2"]),
      targets: (["OB-1"]),
      witness: { trace: [{ "T.ok": true }, { "T.ok": false }] },
      detail: "The event machine can reach a state that violates OB-1 (step trace attached): the event rules do not preserve the obligation.",
    }]);
    const unattributed = run({ machine: QuintMachineRunVerdict.violation(TraceStates.of([st({ "T.ok": true })])) });
    expect(unattributed.findings.toArray()[0]?.targets().toStrings()).toEqual(["OB-2"]);
  });

  test("a failed machine run skips its targets with the verify/run wording per method", () => {
    const sim = run({ machine: QuintMachineRunVerdict.runFailed("boom") });
    expect(sim.skipped.toArray()[0]?.detail()).toBe("quint run failed unexpectedly: boom");
    const bounded = run({ machine: QuintMachineRunVerdict.runFailed("boom") }, "bounded");
    expect(bounded.skipped.toArray()[0]?.detail()).toBe("quint verify failed unexpectedly: boom");
    expect([...run({ machine: QuintMachineRunVerdict.clean() }).findings]).toEqual([]);
    expect([...run({}).findings]).toEqual([]);
  });

  test("temporal obligations: capability skip in simulation, verdicts in bounded, guard for skipped", () => {
    const sim = run({});
    expect(sim.skipped.toArray().find((s) => s.target().asString() === "OB-3")?.detail())
      .toBe("leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them");
    const guarded = run({}, "simulation", [{ target: "OB-3", reason: "compile-error" }]);
    expect(guarded.skipped.toArray().filter((s) => s.target().asString() === "OB-3").length).toBe(1);
    const timeout = run({ temporals: temporalsOf([["OB-3", QuintTemporalVerdict.timeout()]]) }, "bounded");
    expect(timeout.skipped.toArray().find((s) => s.target().asString() === "OB-3")?.detail()).toBe("temporal check exceeded its budget");
    const violated = run({ temporals: temporalsOf([["OB-3", QuintTemporalVerdict.violation(TraceStates.of([st({ "T.ok": false })]))]]) }, "bounded");
    expect(plainFindings([violated.findings.toArray()[0]])[0]).toEqual({
      kind: "conflict",
      frRefs: (["FR-3"]),
      targets: (["OB-3"]),
      witness: { trace: [{ "T.ok": false }] },
      detail: 'Temporal obligation OB-3 (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.',
    });
    const clean = run({ temporals: temporalsOf([["OB-3", QuintTemporalVerdict.clean()]]) }, "bounded");
    expect([...clean.findings]).toEqual([]);
    expect([...run({}, "bounded").findings]).toEqual([]);
  });

  test("scenario verdicts: capability skips, budget/failure skips, and the frozen violation wording", () => {
    const base = run({});
    expect(base.skipped.toArray().find((s) => s.target().asString() === "SC-3")?.detail())
      .toBe("scenarios with a When-event are not checked by the quint backend in v1");
    const unboundFacts = QuintMachinePlan.of({
      invariantComponents: QuintMachineComponents.of([QuintMachineComponent.reconstitute({ id: ObligationId.reconstitute("OB-1"), expression: { op: "ref", path: "T.ok" } })]),
      eventIds: ObligationIds.of([ObligationId.reconstitute("OB-2")]),
      scenariosWithInit: [],
    });
    const unbound = unboundFacts.interpret(machineModel, VerificationSkips.of([]), "simulation", QuintRuns.of(EMPTY_RUNS));
    expect(unbound.skipped.toArray().find((s) => s.target().asString() === "SC-1")?.detail())
      .toBe("quint scenario evaluation requires bindings for every declared attribute");
    const timeout = run({ scenarios: scenariosOf([["SC-1", QuintScenarioVerdict.timeout()]]) });
    expect(timeout.skipped.toArray().find((s) => s.target().asString() === "SC-1")?.detail()).toBe("scenario evaluation exceeded its budget");
    const failed = run({ scenarios: scenariosOf([["SC-1", QuintScenarioVerdict.runFailed("x")]]) });
    expect(failed.skipped.toArray().find((s) => s.target().asString() === "SC-1")?.detail()).toBe("quint run failed unexpectedly: x");

    const acceptViolated = run({ scenarios: scenariosOf([["SC-1", QuintScenarioVerdict.evaluated(true)]]) });
    expect(plainFindings([...acceptViolated.findings])).toEqual([{
      kind: "scenario-violation",
      frRefs: (["FR-1"]),
      targets: (["OB-1", "SC-1"]),
      witness: { model: { "T.ok": false } },
      detail: "Accept scenario SC-1 describes a state the obligations rule out — the requirements reject an example that should be accepted.",
    }]);
    const rejectAccepted = run({ scenarios: scenariosOf([["SC-2", QuintScenarioVerdict.evaluated(false)]]) });
    expect(plainFindings([...rejectAccepted.findings])).toEqual([{
      kind: "scenario-violation",
      frRefs: (["FR-2"]),
      targets: (["SC-2"]),
      witness: { model: { "T.ok": true } },
      detail: "Reject scenario SC-2 is accepted by every obligation — the requirements do not exclude an example that should be rejected.",
    }]);
    const quietAccept = run({ scenarios: scenariosOf([["SC-1", QuintScenarioVerdict.evaluated(false)]]) });
    const quietReject = run({ scenarios: scenariosOf([["SC-2", QuintScenarioVerdict.evaluated(true)]]) });
    expect([...quietAccept.findings, ...quietReject.findings]).toEqual([]);
  });
});

describe("expression evaluation (the invariant component's own attribution, ruling 5)", () => {
  const state = st({ "T.n": 3, "T.b": true, "T.s": "on" });
  const ref = (path: string) => ({ op: "ref", path });
  const int = (value: number) => ({ op: "int", value });
  // 成分は「式が true でないとき違反」——holds は評価が true のときだけ真になる。
  const violated = (expression: Expression): boolean => QuintMachineComponent.reconstitute({ id: ObligationId.reconstitute("OB-1"), expression }).isViolatedIn(state);
  const holds = (expression: Expression): boolean => !violated(expression);
  const equalsInt = (expression: Expression, value: number): Expression => ({ op: "eq", args: [expression, int(value)] });

  test("boolean, comparison, and arithmetic operators evaluate over the state", () => {
    expect(holds({ op: "and", args: [{ op: "bool", value: true }, ref("T.b")] })).toBe(true);
    expect(holds({ op: "or", args: [{ op: "bool", value: false }] })).toBe(false);
    expect(holds({ op: "not", args: [ref("T.b")] })).toBe(false);
    expect(holds({ op: "implies", args: [ref("T.b"), { op: "bool", value: false }] })).toBe(false);
    expect(holds({ op: "iff", args: [ref("T.b"), { op: "bool", value: true }] })).toBe(true);
    expect(holds({ op: "eq", args: [ref("T.s"), { op: "enum", value: "on" }] })).toBe(true);
    expect(holds({ op: "ne", args: [ref("T.n"), int(3)] })).toBe(false);
    expect(holds({ op: "lt", args: [ref("T.n"), int(4)] })).toBe(true);
    expect(holds({ op: "le", args: [ref("T.n"), int(3)] })).toBe(true);
    expect(holds({ op: "gt", args: [ref("T.n"), int(3)] })).toBe(false);
    expect(holds({ op: "ge", args: [ref("T.n"), int(3)] })).toBe(true);
    expect(holds(equalsInt({ op: "add", args: [ref("T.n"), int(1)] }, 4))).toBe(true);
    expect(holds(equalsInt({ op: "sub", args: [ref("T.n"), int(1)] }, 2))).toBe(true);
    expect(holds(equalsInt({ op: "mul", args: [ref("T.n"), int(2)] }, 6))).toBe(true);
  });

  test("missing references and unknown operators fall to null (tolerant evaluation counts as violated)", () => {
    expect(violated({ op: "ref", path: "T.missing" })).toBe(true);
    expect(violated({ op: "mystery" })).toBe(true);
    expect(holds(equalsInt({ op: "int", value: 7 }, 7))).toBe(true);
    expect(holds({ op: "eq", args: [{ op: "ref", path: "T.missing" }, { op: "mystery" }] })).toBe(true);
  });
});

describe("quint degradation reports", () => {
  test("machineUncompilableReport spans obligations and scenarios under the detected method", () => {
    const m = model({
      obligations: [{ id: ObligationId.reconstitute("OB-2"), nature: ObligationNature.reconstitute("event"), frRefs: [] }],
      scenarios: [{ id: ScenarioId.reconstitute("SC-1"), kind: "accept", frRefs: [], bindings: {} }],
    });
    const r = VerificationReport.machineUncompilable(VerificationReportId.of(ap("/v"), "quint"), m, ContentHash.reconstitute("h"), "simulation", "boom");
    expect(r.method()).toBe("simulation");
    expect(r.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`))
      .toEqual(["OB-2:compile-error:boom", "SC-1:compile-error:boom"]);
    const u = VerificationReport.quintUnavailable(VerificationReportId.of(ap("/v"), "quint"), m, ContentHash.reconstitute("h"));
    expect(u.unavailableReason()).toBe("quint CLI is not available (install: npm i -g @informalsystems/quint)");
  });
});

describe("quint plan collections (first-class operations)", () => {
  test("TraceStates and QuintMachineComponents own their step/attribution knowledge", () => {
    const traces = TraceStates.of([st({ "T.ok": true })]).add(st({ "T.ok": false }));
    expect([...traces].length).toBe(2);
    expect(traces.finalState().toDocument()).toEqual({ "T.ok": false });
    expect(TraceStates.of([]).finalState().toDocument()).toEqual({});
    expect(traces.toArray().map((t) => t.toDocument())).toEqual([{ "T.ok": true }, { "T.ok": false }]);

    const comps = QuintMachineComponents.of([]).add(QuintMachineComponent.reconstitute({ id: ObligationId.reconstitute("OB-1"), expression: { op: "ref", path: "T.ok" } }));
    expect(comps.isEmpty()).toBe(false);
    expect([...comps].length).toBe(1);
    expect(comps.ids().toStrings()).toEqual(["OB-1"]);
    expect(comps.violatedBy(st({ "T.ok": false })).ids().toStrings()).toEqual(["OB-1"]);
    expect(comps.violatedBy(st({ "T.ok": true })).isEmpty()).toBe(true);
    expect(comps.toArray().length).toBe(1);

    const plan = QuintMachinePlan.of({ invariantComponents: comps, eventIds: ObligationIds.of([ObligationId.reconstitute("OB-9"), ObligationId.reconstitute("OB-2")]), scenariosWithInit: [] });
    expect(plan.hasInvariantComponents()).toBe(true);
    expect(plan.machineTargets().toStrings()).toEqual(["OB-1", "OB-2", "OB-9"]);
  });
});

