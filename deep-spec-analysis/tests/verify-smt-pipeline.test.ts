import {
  VerificationMethod,
  SkipReason,
  FindingKind,
  RequirementId,
  TriggerName,
  TargetId,
  TargetIds,
  ArtifactPath,
  ContentHash,
  FindingsSchema,
  IrVersion,
  ExpressionTree,
  KeyedIndex,
  KeySet,
  QueryLabel,
} from "@deep-spec/kernel-domain";

// レイヤード verify-smt パイプラインの in-process 検証（PR3、#16）。
//
// 1) golden 同値：conformance fixture を tmp へ複製し、interactor 正形の
//    ユースケースを実 Impl（実 z3 子プロセス込み）で駆動して、書かれた
//    smt.json / cross-check.json を期待 golden とバイト比較する。CLI spawn の
//    conformance スイートと合わせ、同一バイトへの独立経路が 2 本になる。
// 2) ドメイン検査の分岐固定：解釈・クロスチェック・降格・順序の各純関数を
//    直接駆動する（domain 90% 床）。
// 3) interactor のテスト容易性：InMemory ダブルと素の値だけで use case が
//    全経路を踏めることを証明する。

import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "@deep-spec/kernel-adapter";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";

import type { RepositoryError } from "@deep-spec/kernel-usecase";

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}
import {
  FormalModelRepositoryImpl,
  VerificationDirectoryRepositoryImpl,
  Z3SolverClientImpl,
  parseSiblingReportDocument,
  renderVerificationReportBytes,
} from "@deep-spec/requirements-adapter";
import {
  VerificationFindings,
  VerificationReports,
  VerificationSkips,
  BackgroundAssumption,
  Scenario,
  Obligation,
  AttributeDeclaration,
  AttributeDeclarations,
  AttributeValues,
  FrRefs,
  AttributeBound,
  AttributePath,
  BackgroundAssumptionId,
  ObligationNature,
  ScenarioId,
  Obligations,
  Scenarios,
  BackgroundAssumptions,
  RequirementsModel,
  SmtQueryVerdict,
  SmtEventPairProbes,
  SmtEventPairProbe,
  SmtVerificationPlan,
  SmtQueryVerdicts,
  VerificationReport,
  VerificationReportId,
  VerificationFinding,
  FormalModelId,
  ObligationId,
  VerificationSkipped,
 VerificationWitness,} from "@deep-spec/requirements-domain";
import {
  type FormalModelRepository,
  type SmtCheck,
  VerifyRequirementsSmtUseCase,
  type Z3SolverClient,
} from "@deep-spec/requirements-usecase";
import { InMemoryVerificationDirectoryRepository } from "./doubles/in-memory-verification-directory-repository.ts";

// 判定レコードは class（#71 波18）——期待値は平文へ射影して比較する（bun の toEqual は #private を見ない）。
const plainFindings = (findings: Iterable<VerificationFinding>) =>
  [...findings].map((f) => ({ kind: f.kind(), frRefs: f.frRefs().toStrings(), targets: f.targets().toStrings(), witness: f.witness().toDocument(), detail: f.detail() }));

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pluginRoot, "tests", "fixtures", "conformance");
const schemaPath = join(pluginRoot, "src", "entries", "data", "deep-spec-findings-schema.json");
const schemaFile = readContractSchema(schemaPath);
// 合成ルート相当：契約2 のスキーマを一度だけ読んで値にする（entry と同じ形）。
const schema = schemaFile.ok ? FindingsSchema.of(schemaFile.value) : FindingsSchema.unreadable(schemaFile.error.cause);
const sensorPath = join(pluginRoot, "tools", "aidlc-sensor-deep-spec-verify-smt.ts");

// テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
type RawAttributeDeclaration = Omit<Parameters<typeof AttributeDeclaration.of>[0], "values"> & { values?: string[] };
type RawObligation = Omit<Parameters<typeof Obligation.of>[0], "frRefs" | "trigger"> & { frRefs: string[]; trigger?: string };
type RawScenario = Omit<Parameters<typeof Scenario.of>[0], "frRefs"> & { frRefs: string[] };
function model(seed: {
  irVersion?: IrVersion;
  attributes?: RawAttributeDeclaration[];
  obligations?: RawObligation[];
  scenarios?: RawScenario[];
  background?: BackgroundAssumption[];
}): RequirementsModel {
  return RequirementsModel.of({
    id: FormalModelId.of(ap("/test/deep-spec-analysis-formal-model.md")),
    irHash: ContentHash.of("a".repeat(64)),
    sourceDocument: new Uint8Array(),
    irVersion: seed.irVersion ?? IrVersion.of("1.0.0"),
    attributes: AttributeDeclarations.of(
      (seed.attributes ?? []).map((a) => AttributeDeclaration.of({ ...a, values: a.values === undefined ? undefined : AttributeValues.of(a.values) })),
    ),
    obligations: Obligations.of((seed.obligations ?? []).map((o) => Obligation.of({ ...o, frRefs: FrRefs.of(Array.from(o.frRefs, (raw) => RequirementId.of(raw))), trigger: o.trigger === undefined ? undefined : TriggerName.of(o.trigger) }))),
    scenarios: Scenarios.of((seed.scenarios ?? []).map((s) => Scenario.of({ ...s, frRefs: FrRefs.of(Array.from(s.frRefs, (raw) => RequirementId.of(raw))) }))),
    background: BackgroundAssumptions.of(seed.background ?? []),
  });
}

describe("in-process golden equivalence (interactor over real Impls, real z3 child)", () => {
  test("the use case reproduces the golden smt.json and cross-check.json bytes", () => {
    const record = mkdtempSync(join(tmpdir(), "verify-smt-usecase-"));
    try {
      const modelPath = join(record, "deep-spec-analysis-formal-model.md");
      cpSync(join(fixtures, "deep-spec-analysis-formal-model.md"), modelPath);
      const verifyDir = join(record, "deep-spec-verify");
      mkdirSync(verifyDir, { recursive: true });
      // 兄弟バックエンド文書を golden から先置きして、クロスチェックの収束
      // （最後の書き手が全文書から再計算する）も同時に証明する。
      cpSync(join(fixtures, "expected", "quint.json"), join(verifyDir, "quint.json"));

      const outcome = new VerifyRequirementsSmtUseCase(
        new FormalModelRepositoryImpl(),
        new VerificationDirectoryRepositoryImpl(),
        schema,
        new Z3SolverClientImpl({
          selfPath: sensorPath,
          perQueryTimeoutMs: 2000,
          runtimeOverride: undefined,
          workingDirectory: pluginRoot,
        }),
      ).execute({ modelId: FormalModelId.of(ap(modelPath)), verifyDirectory: ap(verifyDir) });

      expect(outcome.kind).toBe("verified");
      expect(readFileSync(join(verifyDir, "smt.json"), "utf-8"))
        .toBe(readFileSync(join(fixtures, "expected", "smt.json"), "utf-8"));
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

function solver(check: SmtCheck): Z3SolverClient {
  return { check: () => check };
}

// テスト用: 生 id の対 → DP キーの索引・集合（裁定 3-1）。
function compiledOf(ids: readonly string[]): KeySet<ObligationId> {
  return KeySet.of(ids.map((id) => ObligationId.of(id)));
}
function labelsOf(entries: readonly (readonly [string, string])[]): KeyedIndex<QueryLabel, TargetId> {
  return KeyedIndex.of(entries.map(([label, target]) => [QueryLabel.of(label), TargetId.of(target)] as const));
}
function gapsOf(entries: readonly (readonly [string, readonly string[]])[]): KeyedIndex<TriggerName, TargetIds> {
  return KeyedIndex.of(entries.map(([trigger, ids]) => [TriggerName.of(trigger), TargetIds.of(Array.from(ids, (raw) => TargetId.of(raw)))] as const));
}
function scenarioQueriesOf(entries: readonly (readonly [string, string])[]): KeyedIndex<ScenarioId, QueryLabel> {
  return KeyedIndex.of(entries.map(([sc, qid]) => [ScenarioId.of(sc), QueryLabel.of(qid)] as const));
}
function verdictsOf(entries: readonly (readonly [string, SmtQueryVerdict])[]): SmtQueryVerdicts {
  return SmtQueryVerdicts.of(KeyedIndex.of(entries.map(([id, v]) => [QueryLabel.of(id), v] as const)));
}

const EMPTY_PLAN: Parameters<typeof SmtVerificationPlan.of>[0] = {
  compiled: compiledOf([]),
  skipped: VerificationSkips.of([]),
  labelToTarget: labelsOf([]),
  eventPairs: SmtEventPairProbes.of([]),
  gapTriggers: gapsOf([]),
  scenarioQueries: scenarioQueriesOf([]),
};

describe("the verify-smt interactor over the InMemory double", () => {
  const DIR = "/tmp/verify";

  test("a missing model resolves to not-applicable and writes nothing", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(err({ kind: "not-found", path: "/x" })),
      reports,
      schema,
      solver({ plan: SmtVerificationPlan.of(EMPTY_PLAN), result: { kind: "solved", verdicts: verdictsOf([]) } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("not-applicable");
    const stored = reports.findAllByDirectory(ap(DIR));
    expect(stored.ok).toBe(true);
    expect(stored.ok ? [...stored.value] : null).toEqual([]);
  });

  test("a corrupt model writes the frozen ir-unreadable degradation without cross-check", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(err({ kind: "corrupt", path: "/x", cause: "IR lacks a semver irVersion" })),
      reports,
      schema,
      solver({ plan: SmtVerificationPlan.of(EMPTY_PLAN), result: { kind: "solved", verdicts: verdictsOf([]) } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("model-unreadable");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.unavailableReason())
      .toBe("IR unreadable: IR lacks a semver irVersion — see the deep-spec-ir-valid sensor for details");
    expect(written.ok && written.value.irVersion().asString()).toBe("0.0.0");
    expect(written.ok && written.value.irHash().equals(ContentHash.ofText(""))).toBe(true);
    expect(reports.findById(VerificationReportId.of(ap(DIR), "cross-check")).ok).toBe(false);
  });

  test("an unsupported IR major writes all-targets skips and recomputes cross-check", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const m = model({
      irVersion: IrVersion.of("2.0.0"),
      obligations: [{ id: ObligationId.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: ["FR-1"] }],
      scenarios: [{ id: ScenarioId.of("SC-1"), kind: "accept", frRefs: [], bindings: {} }],
    });
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(ok(m)),
      reports,
      schema,
      solver({ plan: SmtVerificationPlan.of(EMPTY_PLAN), result: { kind: "solved", verdicts: verdictsOf([]) } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("version-mismatch");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}`))
      .toEqual(["OB-1:ir-version-mismatch", "SC-1:ir-version-mismatch"]);
    expect(written.ok && written.value.skipped().toArray()[0]?.detail())
      .toBe("IR major version 2 is not supported by this backend (supports 1.x.x)");
    expect(reports.findById(VerificationReportId.of(ap(DIR), "cross-check")).ok).toBe(true);
  });

  test("an unavailable solver writes the degradation with plan skips and the caller exits 127", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const m = model({
      obligations: [
        { id: ObligationId.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: [] },
        { id: ObligationId.of("OB-2"), nature: ObligationNature.of("state-temporal"), frRefs: [] },
      ],
    });
    const plan = SmtVerificationPlan.of({
      ...EMPTY_PLAN,
      skipped: VerificationSkips.of([VerificationSkipped.of({ target: TargetId.of("OB-2"), reason: SkipReason.of("capability"), detail: 'nature "state-temporal" is checked by a state-machine backend, not the SMT backend' })]),
    });
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(ok(m)),
      reports,
      schema,
      solver({ plan, result: { kind: "unavailable", reason: "no runtime could execute the z3 child process (node: not on PATH)" } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("solver-unavailable");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.unavailableReason())
      .toBe("no runtime could execute the z3 child process (node: not on PATH)");
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}`))
      .toEqual(["OB-1:unavailable", "OB-2:capability"]);
    expect(written.ok && written.value.skipped().toArray()[0]?.detail()).toBe("z3 could not be executed");
  });

  test("a solved run interprets, persists the conformed report, and converges cross-check", () => {
    const reports = new InMemoryVerificationDirectoryRepository();
    const m = model({
      obligations: [{ id: ObligationId.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: ["FR-1"] }],
      scenarios: [{ id: ScenarioId.of("SC-1"), kind: "reject", frRefs: ["FR-2"], bindings: {} }],
    });
    const plan = SmtVerificationPlan.of({
      ...EMPTY_PLAN,
      compiled: compiledOf(["OB-1"]),
      labelToTarget: labelsOf([["ob_OB_1", "OB-1"]]),
      scenarioQueries: scenarioQueriesOf([["SC-1", "sc:SC-1"]]),
    });
    const verdicts = verdictsOf([
      ["global", SmtQueryVerdict.of({ status: "sat", decodedModel: {} })],
      ["sc:SC-1", SmtQueryVerdict.of({ status: "sat", decodedModel: { "Ticket.priority": 1 } })],
    ]);
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(ok(m)),
      reports,
      schema,
      solver({ plan, result: { kind: "solved", verdicts } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("verified");
    expect(outcome.kind === "verified" && outcome.pass).toBe(false);
    expect(outcome.kind === "verified" && outcome.findingsCount).toBe(1);
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.findings().toArray()[0]?.kind()).toBe("scenario-violation");
    const bytes = written.ok ? renderVerificationReportBytes(written.value) : "";
    expect(Object.keys(JSON.parse(bytes))).toEqual(["backend", "irVersion", "irHash", "method", "findings", "skipped"]);
    const cross = reports.findById(VerificationReportId.of(ap(DIR), "cross-check"));
    expect(cross.ok && cross.value.crossChecked()?.toArray()).toEqual([]);
  });
});

// --- ドメイン検査の分岐固定（純関数の直接駆動） ------------------------------

describe("smt verdict interpretation", () => {
  const twoInvariants = model({
    obligations: [
      { id: ObligationId.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: ["FR-1"] },
      { id: ObligationId.of("OB-2"), nature: ObligationNature.of("numeric"), frRefs: ["FR-2", "FR-1"] },
      { id: ObligationId.of("OB-3"), nature: ObligationNature.of("event"), frRefs: ["FR-3"] },
      { id: ObligationId.of("OB-4"), nature: ObligationNature.of("event"), frRefs: ["FR-4"] },
    ],
    scenarios: [
      { id: ScenarioId.of("SC-1"), kind: "accept", frRefs: ["FR-1"], bindings: {} },
      { id: ScenarioId.of("SC-2"), kind: "reject", frRefs: ["FR-2"], bindings: {} },
    ],
  });
  const plan = SmtVerificationPlan.of({
    compiled: compiledOf(["OB-1", "OB-2", "OB-3", "OB-4"]),
    skipped: VerificationSkips.of([VerificationSkipped.of({ target: TargetId.of("OB-9"), reason: SkipReason.of("capability"), detail: "seed" })]),
    labelToTarget: labelsOf([["ob_OB_1", "OB-1"], ["ob_OB_2", "OB-2"], ["ty_x", "DSC-999"]]),
    eventPairs: SmtEventPairProbes.of([SmtEventPairProbe.of({ qOverlap: QueryLabel.of("evo:OB-3:OB-4"), qJoint: QueryLabel.of("evj:OB-3:OB-4"), a: ObligationId.of("OB-3"), b: ObligationId.of("OB-4"), trigger: TriggerName.of("submit") })]),
    gapTriggers: gapsOf([["submit", ["OB-3", "OB-4"]]]),
    scenarioQueries: scenarioQueriesOf([["SC-1", "sc:SC-1"], ["SC-2", "sc:SC-2"]]),
  });
  const run = (entries: [string, Parameters<typeof SmtQueryVerdict.of>[0]][]) =>
    plan.interpret(twoInvariants, verdictsOf(entries.map(([id, v]) => [id, SmtQueryVerdict.of(v)] as const)));

  test("global unsat becomes one conflict attributed via the OB-prefixed core labels", () => {
    const { findings, skipped } = run([["global", { status: "unsat", core: ["ty_x", "ob_OB_2", "ob_OB_1"] }]]);
    expect(plainFindings([...findings])).toEqual([{
      kind: "conflict",
      frRefs: (["FR-1", "FR-2"]),
      targets: (["OB-1", "OB-2"]),
      witness: { core: ["ob_OB_1", "ob_OB_2", "ty_x"] },
      detail: "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.",
    }]);
    expect([...skipped].map((k) => ({ target: k.target().asString(), reason: k.reason(), detail: k.detail() }))).toEqual([{ target: "OB-9", reason: "capability", detail: "seed" }]);
  });

  test("global unsat suppresses vacuity findings, and an empty core falls back to all invariants", () => {
    const { findings } = run([
      ["global", { status: "unsat", core: [] }],
      ["vac:OB-1", { status: "unsat", core: ["ob_OB_2"] }],
    ]);
    expect(findings.toArray().length).toBe(1);
    expect(findings.toArray()[0]?.targets().toStrings()).toEqual(["OB-1", "OB-2"]);
  });

  test("a conflict with no effective targets is dropped entirely", () => {
    const bare = model({ obligations: [{ id: ObligationId.of("OB-3"), nature: ObligationNature.of("event"), frRefs: [] }] });
    const { findings } = SmtVerificationPlan.of({ ...EMPTY_PLAN, compiled: compiledOf(["OB-3"]) })
      .interpret(bare, verdictsOf([["global", SmtQueryVerdict.of({ status: "unsat", core: [] })]]));
    expect([...findings]).toEqual([]);
  });

  test("global timeout skips every compiled invariant", () => {
    const { skipped } = run([["global", { status: "unknown" }]]);
    expect(skipped.toArray().slice(1).map((k) => ({ target: k.target().asString(), reason: k.reason(), detail: k.detail() }))).toEqual([
      { target: "OB-1", reason: "timeout", detail: "global consistency check exceeded the solver budget" },
      { target: "OB-2", reason: "timeout", detail: "global consistency check exceeded the solver budget" },
    ]);
  });

  test("vacuity unsat merges the obligation into the core targets and dedupes same-target conflicts", () => {
    const { findings } = run([
      ["global", { status: "sat" }],
      ["vac:OB-1", { status: "unsat", core: ["ob_OB_2"] }],
      ["vac:OB-2", { status: "unsat", core: ["ob_OB_1"] }],
    ]);
    expect(findings.toArray().length).toBe(1);
    expect(findings.toArray()[0]?.targets().toStrings()).toEqual(["OB-1", "OB-2"]);
    expect(findings.toArray()[0]?.detail()).toStartWith("The condition of obligation OB-1 can never hold");
  });

  test("vacuity budget becomes a timeout skip for that obligation", () => {
    const { skipped } = run([["vac:OB-2", { status: "budget" }]]);
    expect(skipped.toArray().slice(1).map((k) => ({ target: k.target().asString(), reason: k.reason(), detail: k.detail() }))).toEqual([
      { target: "OB-2", reason: "timeout", detail: "vacuity check for OB-2 exceeded the solver budget" },
    ]);
  });

  test("an overlapping-guards/contradictory-effects pair is a conflict with the frozen wording", () => {
    const { findings } = run([
      ["evo:OB-3:OB-4", { status: "sat" }],
      ["evj:OB-3:OB-4", { status: "unsat", core: [] }],
    ]);
    expect(findings.toArray()[0]?.detail()).toBe(
      'Events OB-3 and OB-4 for trigger "submit" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.',
    );
  });

  test("an undecided event pair skips both obligations; a missing half skips nothing", () => {
    const { skipped } = run([
      ["evo:OB-3:OB-4", { status: "sat" }],
      ["evj:OB-3:OB-4", { status: "unknown" }],
    ]);
    expect(skipped.toArray().slice(1).map((s) => s.target().asString())).toEqual(["OB-3", "OB-4"]);
    expect(run([["evo:OB-3:OB-4", { status: "sat" }]]).skipped.toArray().length).toBe(1);
  });

  test("an errored event-pair half is recorded as a skip, not dropped (thaw #34 item 3)", () => {
    const { findings, skipped } = run([
      ["evo:OB-3:OB-4", { status: "sat" }],
      ["evj:OB-3:OB-4", { status: "error" }],
    ]);
    expect(findings.toArray()).toHaveLength(0);
    expect(skipped.toArray().slice(1).map((k) => ({ target: k.target().asString(), reason: k.reason(), detail: k.detail() }))).toEqual([
      { target: "OB-3", reason: "timeout", detail: 'event-pair check for trigger "submit" exceeded the solver budget' },
      { target: "OB-4", reason: "timeout", detail: 'event-pair check for trigger "submit" exceeded the solver budget' },
    ]);
  });

  test("a sat gap query becomes a completeness-gap carrying the decoded witness state", () => {
    const { findings } = run([["gap:submit", { status: "sat", decodedModel: { "Ticket.priority": 2 } }]]);
    expect(plainFindings([...findings])).toEqual([{
      kind: "completeness-gap",
      frRefs: (["FR-3", "FR-4"]),
      targets: (["OB-3", "OB-4"]),
      witness: { model: { "Ticket.priority": 2 } },
      detail: 'No rule for trigger "submit" applies to the witness state: the behavior of this input region is unspecified.',
    }]);
    expect([...run([["gap:submit", { status: "unsat" }]]).findings]).toEqual([]);
    expect(run([["gap:submit", { status: "error" }]]).skipped.toArray().slice(1).map((s) => s.target().asString())).toEqual(["OB-3", "OB-4"]);
  });

  test("scenario verdicts: accept-unsat and reject-sat violate, undecided skips, missing is silent", () => {
    const { findings } = run([
      ["sc:SC-1", { status: "unsat", core: ["ob_OB_1", "ty_x"] }],
      ["sc:SC-2", { status: "sat", decodedModel: { "Ticket.done": false } }],
    ]);
    expect(findings.toArray().map((f) => f.targets().toStrings())).toEqual([["OB-1", "SC-1"], ["SC-2"]]);
    expect(findings.toArray()[0]?.witness().toDocument()).toEqual({ core: ["ob_OB_1", "ty_x"] });
    expect(findings.toArray()[1]?.witness().toDocument()).toEqual({ model: { "Ticket.done": false } });
    expect(findings.toArray()[0]?.detail()).toStartWith("Accept scenario SC-1 describes a state");
    expect(findings.toArray()[1]?.detail()).toStartWith("Reject scenario SC-2 is still satisfiable");
    expect(run([["sc:SC-1", { status: "budget" }]]).skipped.toArray().slice(1).map((s) => s.target().asString())).toEqual(["SC-1"]);
    expect([...run([]).findings]).toEqual([]);
  });
});

describe("cross-check computation", () => {
  const m = model({
    scenarios: [
      { id: ScenarioId.of("SC-1"), kind: "accept", frRefs: ["FR-2", "FR-1"], bindings: {} },
      { id: ScenarioId.of("SC-2"), kind: "reject", frRefs: [], bindings: {} },
    ],
  });
  const id = VerificationReportId.of(ap("/tmp/verify"), "cross-check");
  const sibling = (backend: string, input: {
    irHash?: string;
    unavailable?: string;
    violated?: string[];
    skippedTargets?: string[];
  }): VerificationReport =>
    VerificationReport.of({
      id: VerificationReportId.of(ap("/tmp/verify"), backend),
      irVersion: IrVersion.of("1.0.0"),
      irHash: ContentHash.ofText(input.irHash ?? "h1"),
      method: VerificationMethod.of("exhaustive"),
      findings: VerificationFindings.of((input.violated ?? []).map((t): VerificationFinding => (VerificationFinding.of({
        kind: FindingKind.of("scenario-violation"),
        frRefs: FrRefs.of([]),
        targets: TargetIds.of(Array.from([t], (raw) => TargetId.of(raw))),
        witness: VerificationWitness.core([]),
        detail: "x",
      })))),
      skipped: VerificationSkips.of((input.skippedTargets ?? []).map((t) => (VerificationSkipped.of({ target: TargetId.of(t), reason: SkipReason.of("capability")})))),
      crossChecked: null,
      unavailableReason: input.unavailable ?? null,
    });

  test("a disagreement yields the frozen finding with the per-backend verdict table", () => {
    const report = VerificationReports.of([sibling("quint", { violated: ["SC-1"] }), sibling("smt", {})]).crossChecked(id, m, ContentHash.ofText("h1"));
    expect(plainFindings(report.findings().toArray())).toEqual([{
      kind: "cross-check-disagreement",
      frRefs: (["FR-1", "FR-2"]),
      targets: (["SC-1"]),
      witness: { verdicts: { quint: "violated", smt: "clean" } },
      detail: 'Backends "quint" and "smt" disagree on scenario SC-1. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.',
    }]);
    expect(report.crossChecked()?.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }))).toEqual([
      { backend: "quint", targets: ["SC-1", "SC-2"] },
      { backend: "smt", targets: ["SC-1", "SC-2"] },
    ]);
    expect(report.irVersion().asString()).toBe("1.0.0");
    expect(report.method()).toBe("exhaustive");
  });

  test("skipped targets, foreign irHash, and unavailable documents never participate", () => {
    const report = VerificationReports.of([
      sibling("quint", { violated: ["SC-1"], skippedTargets: ["SC-1"] }),
      sibling("smt", {}),
      sibling("stale", { irHash: "other", violated: ["SC-2"] }),
      sibling("down", { unavailable: "boom", violated: ["SC-2"] }),
    ]).crossChecked(id, m, ContentHash.ofText("h1"));
    expect(report.findings().toArray()).toEqual([]);
    expect(report.crossChecked()?.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }))).toEqual([
      { backend: "quint", targets: ["SC-2"] },
      { backend: "smt", targets: ["SC-2"] },
    ]);
  });

  test("fewer than two comparable documents produce an empty cross-check", () => {
    const report = VerificationReports.of([sibling("smt", {})]).crossChecked(id, m, ContentHash.ofText("h1"));
    expect(report.findings().toArray()).toEqual([]);
    expect(report.crossChecked()?.toArray()).toEqual([]);
    expect(report.passes()).toBe(true);
  });
});

describe("degradation reports and ordering", () => {
  test("irUnreadableReport freezes the reason, the 0.0.0 version, and the empty-input hash", () => {
    const r = VerificationReport.irUnreadable(VerificationReportId.of(ap("/v"), "smt"), "exhaustive", "IR is not a JSON object");
    expect(r.unavailableReason()).toBe("IR unreadable: IR is not a JSON object — see the deep-spec-ir-valid sensor for details");
    expect(r.irVersion().asString()).toBe("0.0.0");
    expect(r.irHash().equals(ContentHash.ofText(""))).toBe(true);
    expect(r.isUnavailable()).toBe(true);
    expect(r.findingsCount()).toBe(0);
    expect(r.skippedCount()).toBe(0);
  });

  test("versionMismatchReport and solverUnavailableReport carry the frozen skip vocabularies", () => {
    const m = model({
      irVersion: IrVersion.of("3.1.4"),
      obligations: [{ id: ObligationId.of("OB-2"), nature: ObligationNature.of("invariant"), frRefs: [] }],
      scenarios: [{ id: ScenarioId.of("SC-1"), kind: "accept", frRefs: [], bindings: {} }],
    });
    expect(m.supportsMajor(1)).toBe(false);
    expect(m.majorVersion()).toBe(3);
    const vm = VerificationReport.versionMismatch(VerificationReportId.of(ap("/v"), "smt"), m, ContentHash.ofText("h"), "exhaustive");
    expect(vm.skipped().toArray().map((s) => s.target().asString())).toEqual(["OB-2", "SC-1"]);
    const su = VerificationReport.solverUnavailable(
      VerificationReportId.of(ap("/v"), "smt"),
      m,
      ContentHash.ofText("h"),
      VerificationSkips.of([VerificationSkipped.of({ target: TargetId.of("OB-2"), reason: SkipReason.of("compile-error"), detail: "invariant obligation lacks an assert expression" })]),
      "z3-solver is not available in this project: nope",
    );
    expect(su.unavailableReason()).toBe("z3-solver is not available in this project: nope");
    expect(su.skipped().toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual(["OB-2:compile-error", "SC-1:unavailable"]);
  });

  test("finding order: kind rank, then joined targets, then detail; invalid kinds are rejected", () => {
    const f = (kind: string, targets: string[], detail: string): VerificationFinding => (VerificationFinding.of({
      kind: FindingKind.of(kind),
      frRefs: FrRefs.of([]),
      targets: TargetIds.of(Array.from(targets, (raw) => TargetId.of(raw))),
      witness: VerificationWitness.core([]),
      detail,
    }));
    const sorted = VerificationFindings.of([

      f("cross-check-disagreement", ["SC-1"], "d"),
      f("scenario-violation", ["SC-2"], "b"),
      f("scenario-violation", ["SC-2"], "a"),
      f("completeness-gap", ["OB-1"], "c"),
      f("conflict", ["OB-1", "OB-2"], "a"),
    ]).sortedCanonically();
    expect(sorted.toArray().map((x) => `${x.kind()}:${x.targets().joined(",")}:${x.detail()}`)).toEqual([
      "conflict:OB-1,OB-2:a",
      "completeness-gap:OB-1:c",
      "scenario-violation:SC-2:a",
      "scenario-violation:SC-2:b",
      "cross-check-disagreement:SC-1:d",
    ]);
    const skips = VerificationSkips.of([
      VerificationSkipped.of({ target: TargetId.of("OB-10"), reason: SkipReason.of("timeout")}),
      VerificationSkipped.of({ target: TargetId.of("OB-2"), reason: SkipReason.of("unavailable")}),
      VerificationSkipped.of({ target: TargetId.of("OB-2"), reason: SkipReason.of("capability")}),
    ]).sortedCanonically();
    expect(skips.toArray().map((s) => `${s.target().asString()}:${s.reason()}`)).toEqual([
      "OB-2:capability",
      "OB-2:unavailable",
      "OB-10:timeout",
    ]);
  });

  test("the aggregate composes sorted, degrades empty, and preserves typed values", () => {
    const id = VerificationReportId.of(ap("/v"), "smt");
    expect(id.equals(VerificationReportId.of(ap("/v"), "smt"))).toBe(true);
    expect(id.equals(VerificationReportId.of(ap("/w"), "smt"))).toBe(false);
    expect(id.fileName()).toBe("smt.json");
    const composed = VerificationReport.compose({
      id,
      irVersion: IrVersion.of("1.0.0"),
      irHash: ContentHash.ofText("h"),
      method: "exhaustive",
      findings: VerificationFindings.of([
        VerificationFinding.of({ kind: FindingKind.of("scenario-violation"), frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["SC-1"], (raw) => TargetId.of(raw))), witness: VerificationWitness.core([]), detail: "b" }),
        VerificationFinding.of({ kind: FindingKind.of("conflict"), frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["OB-1"], (raw) => TargetId.of(raw))), witness: VerificationWitness.core([]), detail: "a" }),
      ]),
      skipped: VerificationSkips.of([VerificationSkipped.of({ target: TargetId.of("OB-2"), reason: SkipReason.of("timeout")}), VerificationSkipped.of({ target: TargetId.of("OB-1"), reason: SkipReason.of("capability")})]),
    });
    expect(composed.findings().toArray().map((x) => x.kind())).toEqual(["conflict", "scenario-violation"]);
    expect(composed.skipped().toArray().map((x) => x.target().asString())).toEqual(["OB-1", "OB-2"]);
    expect(composed.passes()).toBe(false);
    const degraded = composed.degraded("why");
    expect(degraded.unavailableReason()).toBe("why");
    expect(degraded.findings().toArray()).toEqual([]);
    expect(degraded.crossChecked()).toBe(null);
    const back = VerificationReport.of({
      id,
      irVersion: composed.irVersion(),
      irHash: composed.irHash(),
      method: VerificationMethod.of(composed.method()),
      findings: composed.findings(),
      skipped: composed.skipped(),
      crossChecked: null,
      unavailableReason: null,
    });
    expect(back.findings().toArray()).toEqual(composed.findings().toArray());
  });

  test("an expression tree finds primes only through nested references (ruling 2)", () => {
    expect(ExpressionTree.of({ op: "ref", path: "a", prime: true }).usesPrime()).toBe(true);
    expect(ExpressionTree.of({
      op: "and",
      args: [{ op: "bool", value: true }, { op: "not", args: [{ op: "ref", path: "a", prime: true }] }],
    }).usesPrime()).toBe(true);
    expect(ExpressionTree.of({ op: "eq", args: [{ op: "ref", path: "a" }, { op: "int", value: 1 }] }).usesPrime()).toBe(false);
    expect(ExpressionTree.of({ op: "and", args: [{ op: "ref", path: "b" }, { op: "ref", path: "a", prime: true }] }).referencedPaths()).toEqual(["a", "b"]);
    expect(ExpressionTree.of({ op: "ref", path: "a", prime: true }).assignsPrimed("a")).toBe(true);
    expect(ExpressionTree.of({ op: "ref", path: "a" }).assignsPrimed("a")).toBe(false);
    const e = { op: "int", value: 1 };
    expect(ExpressionTree.of(e).asExpression()).toEqual(e);
    expect(ExpressionTree.of(e).asExpression()).not.toBe(e);
  });

  test("the model resolves targets, references, and attributes as the old free functions did", () => {
    const m = model({
      attributes: [{ path: AttributePath.of("Ticket.priority"), kind: "int", min: AttributeBound.of(0), max: AttributeBound.of(3) }],
      obligations: [
        { id: ObligationId.of("OB-2"), nature: ObligationNature.of("invariant"), frRefs: ["FR-2"] },
        { id: ObligationId.of("OB-1"), nature: ObligationNature.of("event"), frRefs: ["FR-1", "FR-2"] },
      ],
      scenarios: [{ id: ScenarioId.of("SC-1"), kind: "accept", frRefs: ["FR-2"], bindings: {} }],
      background: [BackgroundAssumption.of({ id: BackgroundAssumptionId.of("B1"), assert: { op: "bool", value: true } })],
    });
    expect(m.allTargets().toStrings()).toEqual(["OB-1", "OB-2", "SC-1"]);
    expect(m.frRefsOf(TargetIds.of(Array.from(["OB-1", "SC-1"], (raw) => TargetId.of(raw)))).toStrings()).toEqual(["FR-1", "FR-2"]);
    expect(m.frRefsOf(TargetIds.of(Array.from(["OB-999"], (raw) => TargetId.of(raw)))).toArray()).toEqual([]);
    expect(m.attributeAt("Ticket.priority")?.maxBound()?.asNumber()).toBe(3);
    expect(m.attributeAt("Ticket.priority")?.minBound()?.asNumber()).toBe(0);
    expect(m.attributeAt("Ticket.priority")?.isInt()).toBe(true);
    expect(m.attributeAt("Ticket.priority")?.isAt("Ticket.priority")).toBe(true);
    expect(m.attributeAt("nope")).toBe(undefined);
    expect(m.attributes().toArray().length).toBe(1);
    expect(m.obligations().toArray().length).toBe(2);
    expect(m.scenarios().toArray().length).toBe(1);
    expect(m.background().toArray()[0]?.id().asString()).toBe("B1");
    expect(m.irVersion().asString()).toBe("1.0.0");
    expect(m.supportsMajor(1)).toBe(true);
  });
});

describe("smt plan collections (first-class operations)", () => {
  test("SmtEventPairProbes holds issuance order under add", () => {
    const probe = SmtEventPairProbe.of({ qOverlap: QueryLabel.of("evo:a:b"), qJoint: QueryLabel.of("evj:a:b"), a: ObligationId.of("OB-1"), b: ObligationId.of("OB-2"), trigger: TriggerName.of("go") });
    expect(probe.targets().toStrings()).toEqual(["OB-1", "OB-2"]);
    const probes = SmtEventPairProbes.of([]).add(probe);
    expect([...probes]).toEqual([probe]);
    expect(probes.toArray()).toEqual([probe]);
  });
});

describe("sibling-document hardening pin (thaw #34 item 2 — resolved by the wave-4b explicit mappings)", () => {
  test("a malformed sibling is rejected without dropping invalid elements", () => {
    const report = parseSiblingReportDocument(ArtifactPath.of("/tmp/x"), "smt.json", {
      backend: "smt",
      findings: [42, { kind: "conflict", frRefs: "nope", targets: 7, detail: 3 }],
      skipped: ["junk", { target: 1 }],
      crossChecked: [null, { backend: 5, targets: "x" }],
    });
    expect(report.ok).toBe(false);
  });
});
