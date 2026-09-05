import { EnumerationMembers } from "@deep-spec/kernel-domain";
import { EnumerationMember } from "@deep-spec/kernel-domain";
import { scenarioBindings } from "./binding-fixtures.ts";
import { SkipReason, RequirementIdentifier, TriggerName, TargetIdentifier, TargetIdentifiers, ContentHash, FindingsSchema, IntermediateRepresentationVersion, ArtifactPath, type Expression, KeyedIndex } from "@deep-spec/kernel-domain";

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
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "@deep-spec/kernel-adapter";

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { RepositoryError } from "@deep-spec/kernel-usecase";

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}
import { FormalModelRepositoryImplementation, QuintClientImplementation, VerificationDirectoryRepositoryImplementation, renderVerificationReportBytes } from "@deep-spec/requirements-adapter";
import { BackgroundAssumption, Scenario, Obligation, RequirementAttributeDeclaration, RequirementAttributeDeclarations, FunctionalRequirementReferences, ObligationIdentifier, ObligationNature, ScenarioIdentifier, Obligations, Scenarios, BackgroundAssumptions, RequirementsModel, QuintMachineComponents, QuintMachinePlan, QuintMachineComponent, QuintMachineRunVerdict, QuintRuns, QuintScenarioVerdict, QuintTemporalVerdict, TraceStates, VerificationReportIdentifier, VerificationSkips, FormalModelIdentifier, ObligationIdentifiers, VerificationSkipped, VerificationFinding, VerificationReport, AttributePath, TraceState, TraceValue } from "@deep-spec/requirements-domain";
import { type FormalModelRepository, type QuintCheckResult, type QuintClient, VerifyRequirementsQuintUseCase } from "@deep-spec/requirements-usecase";
import { InMemoryVerificationDirectoryRepository } from "./doubles/in-memory-verification-directory-repository.ts";

// テスト用: 平文の状態 → TraceState（裁定 2 で値オブジェクトになった）。
function st(values: { [path: string]: boolean | number | string }): TraceState {
  return TraceState.of(Object.entries(values).map(([path, value]) => [AttributePath.of(path), TraceValue.of(value)] as const));
}

// 判定レコードは class（#71 波18）——期待値は平文へ射影して比較する（bun の toEqual は #private を見ない）。
const plainFindings = (findings: Iterable<VerificationFinding>) =>
  [...findings].map((f) => ({ kind: f.kind(), frRefs: f.functionalRequirementReferences().toStrings(), targets: f.targets().toStrings(), witness: f.witness().toDocument(), detail: f.detail() }));

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pluginRoot, "tests", "fixtures", "conformance");
const schemaPath = join(pluginRoot, "src", "entries", "data", "deep-spec-findings-schema.json");
const schemaFile = readContractSchema(schemaPath);
// 合成ルート相当：契約2 のスキーマを一度だけ読んで値にする（entry と同じ形）。
const schema = schemaFile.ok ? FindingsSchema.of(schemaFile.value) : FindingsSchema.unreadable(schemaFile.error.cause);

// テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
type RawAttributeDeclaration = Omit<Parameters<typeof RequirementAttributeDeclaration.of>[0], "values"> & { values?: string[] };
type RawObligation = Omit<Parameters<typeof Obligation.of>[0], "functionalRequirementReferences" | "trigger"> & { frRefs: string[]; trigger?: string };
type RawScenario = Omit<Parameters<typeof Scenario.of>[0], "functionalRequirementReferences"> & { frRefs: string[] };
function model(seed: {
  irVersion?: IntermediateRepresentationVersion;
  attributes?: RawAttributeDeclaration[];
  obligations?: RawObligation[];
  scenarios?: RawScenario[];
  background?: BackgroundAssumption[];
}): RequirementsModel {
  return RequirementsModel.of({
    id: FormalModelIdentifier.of(ap("/test/deep-spec-analysis-formal-model.md")),
    irHash: ContentHash.of(HASH),
    sourceDocument: new Uint8Array(),
    irVersion: seed.irVersion ?? IntermediateRepresentationVersion.of("1.0.0"),
    attributes: RequirementAttributeDeclarations.of(
      (seed.attributes ?? []).map((a) => RequirementAttributeDeclaration.of({ ...a, values: a.values === undefined ? undefined : EnumerationMembers.of((a.values).map((value) => EnumerationMember.of(value))) })),
    ),
    obligations: Obligations.of((seed.obligations ?? []).map((o) => Obligation.of({ ...o, functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(o.frRefs, (raw) => RequirementIdentifier.of(raw))), trigger: o.trigger === undefined ? undefined : TriggerName.of(o.trigger) }))),
    scenarios: Scenarios.of((seed.scenarios ?? []).map((s) => Scenario.of({ ...s, functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(s.frRefs, (raw) => RequirementIdentifier.of(raw))) }))),
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
        new FormalModelRepositoryImplementation(),
        new VerificationDirectoryRepositoryImplementation(),
        schema,
        new QuintClientImplementation({
          quintBin: join(pluginRoot, "node_modules", ".bin", "quint"),
          methodOverride: "simulation",
          apalacheDistSet: false,
          homeDirectory: "",
        }),
      ).execute({ modelId: FormalModelIdentifier.of(ap(modelPath)), verifyDirectory: ap(verifyDir) });

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

// 予算超過の経路を実 CLI で踏む（issue #128）。quint 0.32 は Apalache サーバの
// 後始末ハンドラを exit / SIGINT / SIGUSR1 / SIGUSR2 / uncaughtException にだけ
// 登録するので、クライアントは既定の SIGTERM ではなく SIGINT で止める。SIGINT を
// 受けた quint は自分で exit するため res.signal は null になりうる——予算超過の
// 判定が signal ではなく ETIMEDOUT に載っていることをここで固定する（載っていな
// ければ timeout は run-failed に化けて golden の skip 文言が変わる）。孤児サーバ
// が実際に片付くことは実 Apalache を要するので live smoke が受け持つ。
describe("the machine phase over the real quint CLI, run out of budget", () => {
  test("an exhausted budget stays a timeout verdict — no throw, and the frozen skip wording holds", () => {
    const client = new QuintClientImplementation({
      quintBin: join(pluginRoot, "node_modules", ".bin", "quint"),
      methodOverride: "simulation",
      apalacheDistSet: false,
      homeDirectory: "",
      // 実測: この機械の quint run は約 200ms、起動だけでも 130ms を切らない。
      // 50ms はどの環境でも確実に予算を割る。
      timeoutOverrideMs: 50,
    });
    const outcome = client.check(model({
      attributes: [{ path: AttributePath.of("order.state"), kind: "enum", values: ["open", "closed"] }],
      obligations: [{
        id: ObligationIdentifier.of("OB-1"),
        nature: ObligationNature.of("invariant"),
        frRefs: [],
        assert: { op: "ne", args: [{ op: "ref", path: "order.state" }, { op: "enum", value: "closed" }] },
      }],
    }));
    expect(outcome.kind).toBe("checked");
    const machine = outcome.kind === "checked" ? outcome.runs.machineRun() : null;
    expect(machine?.abortsMachineTargets()).toBe(true);
    expect(machine?.skipsFor(TargetIdentifiers.of(Array.from(["OB-1"], (raw) => TargetIdentifier.of(raw))), false).map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`))
      .toEqual(["OB-1:timeout:machine invariant check exceeded its budget"]);
  }, 60_000);
});

// 答えられなかった実行は clean ではない（#132 の CI が同一コミットで赤→緑になった
// 件の根本原因）。#runQuint は timedOut と出力と ITF しか持ち帰らず、spawn 失敗
// （CI 負荷下の EAGAIN）も非ゼロ終了も捨てていた。その上で各フェーズは「ITF が
// 無く、出力に小文字の "error" も無い」を clean と読んだ——OOM の "FATAL ERROR"、
// Node の "TypeError"、出力の無い fork 失敗はどれも小文字の "error" を含まない
// ので「違反なし」に化け、simulation の findings が 0 件になって golden 比較が
// 気まぐれに落ちた。健全な quint は clean でも violation でも ITF を書き、clean
// は 0 で終わる（実測、quint 0.32）。だから ITF 無しはプロセスの事実で見分ける。
describe("a quint that dies without saying 'error' is run-failed, never clean", () => {
  const tail = "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory";
  const fakeQuint = (dir: string): string => {
    const bin = join(dir, "quint");
    writeFileSync(bin, [
      "#!/bin/sh",
      // probe は通す——CLI は「在る」。壊れるのは実行のほう。
      'if [ "$1" = "--version" ]; then echo 0.32.0; exit 0; fi',
      `echo "${tail}" >&2`,
      "exit 134",
    ].join("\n"), { mode: 0o755 });
    return bin;
  };
  const brokenModel = () => model({
    attributes: [{ path: AttributePath.of("order.state"), kind: "enum", values: ["open", "closed"] }],
    obligations: [{
      id: ObligationIdentifier.of("OB-1"),
      nature: ObligationNature.of("invariant"),
      frRefs: [],
      assert: { op: "ne", args: [{ op: "ref", path: "order.state" }, { op: "enum", value: "closed" }] },
    }],
    scenarios: [{ id: ScenarioIdentifier.of("SC-1"), kind: "accept", frRefs: [], bindings: scenarioBindings({ "order.state": "open" }) }],
  });

  test("simulation: the machine phase and the scenario phase both say unavailable, with the output tail", () => {
    const dir = mkdtempSync(join(tmpdir(), "deep-spec-fake-quint-"));
    try {
      const client = new QuintClientImplementation({ quintBin: fakeQuint(dir), methodOverride: "simulation", apalacheDistSet: false, homeDirectory: "" });
      const m = brokenModel();
      const outcome = client.check(m);
      expect(outcome.kind).toBe("checked");
      if (outcome.kind !== "checked") return;
      const machine = outcome.runs.machineRun();
      expect(machine?.abortsMachineTargets()).toBe(true);
      expect(machine?.skipsFor(TargetIdentifiers.of(Array.from(["OB-1"], (raw) => TargetIdentifier.of(raw))), false).map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`))
        .toEqual([`OB-1:unavailable:quint run failed unexpectedly: ${tail}`]);
      expect(outcome.runs.scenarioOf(ScenarioIdentifier.of("SC-1"))?.skipFor(TargetIdentifier.of("SC-1"))?.detail())
        .toBe(`quint run failed unexpectedly: ${tail}`);
      // interpret まで通しても findings 0 件のまま黙らない——対象が理由つきで skip に残る。
      const { findings, skipped } = outcome.plan.interpret(m, outcome.compileSkips, outcome.method, outcome.runs);
      expect([...findings]).toEqual([]);
      expect(skipped.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual(["OB-1:unavailable", "SC-1:unavailable"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  // temporal は bounded（実 Apalache）でしか実 CLI を踏めないので、値オブジェクトの
  // 側で「失敗は unavailable」を固定する。adapter 側の分岐は machine / scenario と
  // 同じ #didNotAnswer なので、その述語の検出力は上のテストが担う。
  test("bounded: a temporal run that failed is unavailable with the verify wording, never clean", () => {
    const failed = QuintTemporalVerdict.runFailed(tail);
    expect(failed.isViolation()).toBe(false);
    expect(failed.skipFor(TargetIdentifier.of("OB-2"))?.reason()).toBe("unavailable");
    expect(failed.skipFor(TargetIdentifier.of("OB-2"))?.detail()).toBe(`quint verify failed unexpectedly: ${tail}`);
    expect(failed.witness().toDocument()).toEqual({ model: {} });
    expect(QuintTemporalVerdict.clean().skipFor(TargetIdentifier.of("OB-2"))).toBeNull();
  });
});

// --- interactor の全経路（InMemory ダブル＋素の値のみ） ----------------------

function formalModels(result: Result<RequirementsModel, RepositoryError>): FormalModelRepository {
  return { findById: () => result, store: () => ok(undefined) };
}

function quint(result: QuintCheckResult): QuintClient {
  return { check: () => result };
}

// テスト用: 生 id の対 → DP キーの索引（裁定 3-1）。
function temporalsOf(entries: readonly (readonly [string, QuintTemporalVerdict])[]): KeyedIndex<ObligationIdentifier, QuintTemporalVerdict> {
  return KeyedIndex.of(entries.map(([id, v]) => [ObligationIdentifier.of(id), v] as const));
}
function scenariosOf(entries: readonly (readonly [string, QuintScenarioVerdict])[]): KeyedIndex<ScenarioIdentifier, QuintScenarioVerdict> {
  return KeyedIndex.of(entries.map(([id, v]) => [ScenarioIdentifier.of(id), v] as const));
}

const EMPTY_RUNS: Parameters<typeof QuintRuns.of>[0] = { machine: null, temporals: temporalsOf([]), scenarios: scenariosOf([]) };

const HASH = "a".repeat(64);

describe("the verify-quint interactor over the InMemory double", () => {
  const DIR = "/tmp/verify-quint";

  test("a corrupt model writes the simulation-method ir-unreadable degradation", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(err({ kind: "corrupt", path: "/x", cause: "IR is not a JSON object" })),
      reports,
      schema,
      quint({ kind: "cli-unavailable" }),
    ).execute({ modelId: FormalModelIdentifier.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("model-unreadable");
    const written = reports.findById(VerificationReportIdentifier.of(ap(DIR), "quint"));
    expect(written.ok && written.value.method()).toBe("simulation");
    expect(written.ok && written.value.unavailableReason())
      .toBe("IR unreadable: IR is not a JSON object — see the deep-spec-ir-valid sensor for details");
    expect(reports.findById(VerificationReportIdentifier.of(ap(DIR), "cross-check")).ok).toBe(false);
  });

  test("a missing quint CLI writes the frozen unavailable document and the caller exits 127", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const m = model({
      obligations: [{ id: ObligationIdentifier.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: [] }],
      scenarios: [{ id: ScenarioIdentifier.of("SC-1"), kind: "accept", frRefs: [], bindings: scenarioBindings({}) }],
    });
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(ok(m)),
      reports,
      schema,
      quint({ kind: "cli-unavailable" }),
    ).execute({ modelId: FormalModelIdentifier.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("backend-unavailable");
    const written = reports.findById(VerificationReportIdentifier.of(ap(DIR), "quint"));
    expect(written.ok && written.value.unavailableReason())
      .toBe("quint CLI is not available (install: npm i -g @informalsystems/quint)");
    expect(written.ok && written.value.method()).toBe("simulation");
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`))
      .toEqual(["OB-1:unavailable:quint CLI missing", "SC-1:unavailable:quint CLI missing"]);
    expect(reports.findById(VerificationReportIdentifier.of(ap(DIR), "cross-check")).ok).toBe(true);
  });

  test("an uncompilable machine records every target as compile-error under the detected method", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const m = model({
      obligations: [{ id: ObligationIdentifier.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: [] }],
      scenarios: [{ id: ScenarioIdentifier.of("SC-1"), kind: "accept", frRefs: [], bindings: scenarioBindings({}) }],
    });
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(ok(m)),
      reports,
      schema,
      quint({ kind: "machine-uncompilable", method: "bounded", error: 'state variable name collision: "a_b"' }),
    ).execute({ modelId: FormalModelIdentifier.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("machine-uncompilable");
    const written = reports.findById(VerificationReportIdentifier.of(ap(DIR), "quint"));
    expect(written.ok && written.value.method()).toBe("bounded");
    expect(written.ok && written.value.isUnavailable()).toBe(false);
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}`))
      .toEqual(["OB-1:compile-error", "SC-1:compile-error"]);
    expect(written.ok && written.value.skipped().toArray()[0]?.detail()).toBe('state variable name collision: "a_b"');
  });

  test("a checked run interprets, persists the conformed report, and reports the detected method", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const m = model({
      obligations: [{ id: ObligationIdentifier.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: ["FR-1"], assert: { op: "bool", value: true } }],
      scenarios: [{ id: ScenarioIdentifier.of("SC-1"), kind: "reject", frRefs: ["FR-2"], bindings: scenarioBindings({ "T.x": 1 }) }],
    });
    const plan = QuintMachinePlan.of({
      invariantComponents: QuintMachineComponents.of([QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: { op: "bool", value: true } })]),
      eventIds: ObligationIdentifiers.of([]),
      scenariosWithInit: [ScenarioIdentifier.of("SC-1")],
    });
    const runs = QuintRuns.of({
      machine: QuintMachineRunVerdict.clean(),
      temporals: temporalsOf([]),
      scenarios: scenariosOf([["SC-1", QuintScenarioVerdict.evaluated(false)]]),
    });
    const outcome = new VerifyRequirementsQuintUseCase(
      formalModels(ok(m)),
      reports,
      schema,
      quint({ kind: "checked", method: "bounded", plan, compileSkips: VerificationSkips.of([]), runs }),
    ).execute({ modelId: FormalModelIdentifier.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("verified");
    expect(outcome.kind === "verified" && outcome.pass).toBe(false);
    expect(outcome.kind === "verified" && outcome.method).toBe("bounded");
    const written = reports.findById(VerificationReportIdentifier.of(ap(DIR), "quint"));
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
      { id: ObligationIdentifier.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: ["FR-1"], assert: { op: "ref", path: "T.ok" } },
      { id: ObligationIdentifier.of("OB-2"), nature: ObligationNature.of("event"), frRefs: ["FR-2"] },
      { id: ObligationIdentifier.of("OB-3"), nature: ObligationNature.of("state-temporal"), frRefs: ["FR-3"], temporal: { pattern: "leads-to" } },
    ],
    scenarios: [
      { id: ScenarioIdentifier.of("SC-1"), kind: "accept", frRefs: ["FR-1"], bindings: scenarioBindings({ "T.ok": false }) },
      { id: ScenarioIdentifier.of("SC-2"), kind: "reject", frRefs: ["FR-2"], bindings: scenarioBindings({ "T.ok": true }) },
      { id: ScenarioIdentifier.of("SC-3"), kind: "accept", frRefs: [], bindings: scenarioBindings({}), event: { trigger: TriggerName.of("go") } },
    ],
  });
  const plan = QuintMachinePlan.of({
    invariantComponents: QuintMachineComponents.of([QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: { op: "ref", path: "T.ok" } })]),
    eventIds: ObligationIdentifiers.of([ObligationIdentifier.of("OB-2")]),
    scenariosWithInit: [ScenarioIdentifier.of("SC-1"), ScenarioIdentifier.of("SC-2")],
  });
  const run = (runs: Partial<Parameters<typeof QuintRuns.of>[0]>, method = "simulation", compileSkips: { target: string; reason: string }[] = []) =>
    plan.interpret(machineModel, VerificationSkips.of(compileSkips.map((k) => VerificationSkipped.of({ target: TargetIdentifier.of(k.target), reason: SkipReason.of(k.reason)}))), method, QuintRuns.of({ ...EMPTY_RUNS, ...runs }));

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

  // 縮退は黙らない。結果が一つも返らなかった実行は「違反が無かった」と同じ姿に
  // なってはいけない——それでは quint が動かなかった回が pass に化け、golden 比較が
  // 気まぐれに落ちるだけになる。判定を出せなかった対象は unavailable として言う。
  test("runs that returned nothing are unavailable per target, never silence", () => {
    const simulation = run({});
    expect(simulation.skipped.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual([
      // 機械対象は判定そのものが返らなかった。
      "OB-1:unavailable",
      "OB-2:unavailable",
      // leads-to は simulation では決められない——これは環境ではなく仕様の限界。
      "OB-3:capability",
      // 束縛の揃ったシナリオは実行されるはずだった。
      "SC-1:unavailable",
      "SC-2:unavailable",
      // When-event 付きは v1 の対象外。
      "SC-3:capability",
    ]);
    expect(simulation.skipped.toArray().filter((s) => s.reason() === "unavailable").map((s) => s.detail())).toEqual([
      "quint returned no machine run: the event machine was not decided",
      "quint returned no machine run: the event machine was not decided",
      "quint returned no run for this scenario",
      "quint returned no run for this scenario",
    ]);
    // bounded では leads-to も実行されるはずなので、返らなければ同じく unavailable。
    const bounded = run({}, "bounded");
    expect(bounded.skipped.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual([
      "OB-1:unavailable",
      "OB-2:unavailable",
      "OB-3:unavailable",
      "SC-1:unavailable",
      "SC-2:unavailable",
      "SC-3:capability",
    ]);
    expect(bounded.skipped.toArray()[2]?.detail()).toBe("quint returned no run for this temporal obligation");
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
      invariantComponents: QuintMachineComponents.of([QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: { op: "ref", path: "T.ok" } })]),
      eventIds: ObligationIdentifiers.of([ObligationIdentifier.of("OB-2")]),
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
  const violated = (expression: Expression): boolean => QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression }).isViolatedIn(state);
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
      obligations: [{ id: ObligationIdentifier.of("OB-2"), nature: ObligationNature.of("event"), frRefs: [] }],
      scenarios: [{ id: ScenarioIdentifier.of("SC-1"), kind: "accept", frRefs: [], bindings: scenarioBindings({}) }],
    });
    const r = VerificationReport.machineUncompilable(VerificationReportIdentifier.of(ap("/v"), "quint"), m, ContentHash.ofText("h"), "simulation", "boom");
    expect(r.method()).toBe("simulation");
    expect(r.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`))
      .toEqual(["OB-2:compile-error:boom", "SC-1:compile-error:boom"]);
    const u = VerificationReport.quintUnavailable(VerificationReportIdentifier.of(ap("/v"), "quint"), m, ContentHash.ofText("h"));
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

    const comps = QuintMachineComponents.of([]).add(QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: { op: "ref", path: "T.ok" } }));
    expect(comps.isEmpty()).toBe(false);
    expect([...comps].length).toBe(1);
    expect(comps.ids().toStrings()).toEqual(["OB-1"]);
    expect(comps.violatedBy(st({ "T.ok": false })).ids().toStrings()).toEqual(["OB-1"]);
    expect(comps.violatedBy(st({ "T.ok": true })).isEmpty()).toBe(true);
    expect(comps.toArray().length).toBe(1);

    const plan = QuintMachinePlan.of({ invariantComponents: comps, eventIds: ObligationIdentifiers.of([ObligationIdentifier.of("OB-9"), ObligationIdentifier.of("OB-2")]), scenariosWithInit: [] });
    expect(plan.machineTargets().toStrings()).toEqual(["OB-1", "OB-2", "OB-9"]);
  });
});

