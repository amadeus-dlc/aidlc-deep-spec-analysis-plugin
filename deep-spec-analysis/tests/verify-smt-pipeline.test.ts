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
import { readContractSchema } from "../tools/kernel/adapter/index.ts";
import { type Result, err, ok } from "../tools/kernel/infrastructure/index.ts";
import { ArtifactPath, ContentHash, IrVersion, expressionUsesPrime } from "../tools/kernel/domain/index.ts";
import type { RepositoryError } from "../tools/kernel/usecase/index.ts";

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}
import {
  FormalModelRepositoryImpl,
  VerificationReportRepositoryImpl,
  Z3SolverClientImpl,
  renderVerificationReportBytes,
} from "../tools/requirements/adapter/index.ts";
import {
  VerificationFindings,
  VerificationReports,
  VerificationSkips,
  type BackgroundAssumption,
  type Scenario,
  type Obligation,
  type AttributeDeclaration,
  AttributeDeclarations,
  Obligations,
  Scenarios,
  BackgroundAssumptions,
  RequirementsModel,
  type SmtPlanFactsSeed,
  type SmtQueryVerdict,
  SmtEventPairProbes,
  SmtPlanFacts,
  SmtQueryVerdicts,
  VerificationReport,
  VerificationReportId,
  type VerificationFinding,
  FormalModelId,
} from "../tools/requirements/domain/index.ts";
import {
  type AcquiredFormalModel,
  type FormalModelRepository,
  type SmtCheck,
  VerifyRequirementsSmtUseCase,
  type Z3SolverClient,
} from "../tools/requirements/usecase/index.ts";
import { InMemoryVerificationReportRepository } from "./doubles/in-memory-verification-report-repository.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pluginRoot, "tests", "fixtures", "conformance");
const schemaPath = join(pluginRoot, "tools", "data", "deep-spec-findings-schema.json");
const schema = readContractSchema(schemaPath);
const sensorPath = join(pluginRoot, "tools", "aidlc-sensor-deep-spec-verify-smt.ts");

function model(seed: {
  irVersion?: IrVersion;
  attributes?: AttributeDeclaration[];
  obligations?: Obligation[];
  scenarios?: Scenario[];
  background?: BackgroundAssumption[];
}): RequirementsModel {
  return RequirementsModel.reconstitute({
    id: FormalModelId.of(ap("/test/deep-spec-analysis-formal-model.md")),
    irVersion: seed.irVersion ?? IrVersion.reconstitute("1.0.0"),
    attributes: AttributeDeclarations.of(seed.attributes ?? []),
    obligations: Obligations.of(seed.obligations ?? []),
    scenarios: Scenarios.of(seed.scenarios ?? []),
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
        new VerificationReportRepositoryImpl(schemaPath),
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

function formalModels(result: Result<AcquiredFormalModel, RepositoryError>): FormalModelRepository {
  return { findById: () => result };
}

function solver(check: SmtCheck): Z3SolverClient {
  return { check: () => check };
}

const EMPTY_FACTS: SmtPlanFactsSeed = {
  compiled: new Map(),
  skipped: VerificationSkips.of([]),
  labelToTarget: new Map(),
  eventPairs: SmtEventPairProbes.of([]),
  gapTriggers: new Map(),
  scenarioQueries: new Map(),
};

describe("the verify-smt interactor over the InMemory double", () => {
  const DIR = "/tmp/verify";

  test("a missing model resolves to not-applicable and writes nothing", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(err({ kind: "not-found", path: "/x" })),
      reports,
      solver({ facts: SmtPlanFacts.of(EMPTY_FACTS), result: { kind: "solved", verdicts: SmtQueryVerdicts.of(new Map()) } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("not-applicable");
    const stored = reports.findAllByDirectory(ap(DIR));
    expect(stored.ok).toBe(true);
    expect(stored.ok ? [...stored.value] : null).toEqual([]);
  });

  test("a corrupt model writes the frozen ir-unreadable degradation without cross-check", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(err({ kind: "corrupt", path: "/x", cause: "IR lacks a semver irVersion" })),
      reports,
      solver({ facts: SmtPlanFacts.of(EMPTY_FACTS), result: { kind: "solved", verdicts: SmtQueryVerdicts.of(new Map()) } }),
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
    const reports = new InMemoryVerificationReportRepository(schema);
    const m = model({
      irVersion: IrVersion.reconstitute("2.0.0"),
      obligations: [{ id: "OB-1", nature: "invariant", frRefs: ["FR-1"] }],
      scenarios: [{ id: "SC-1", kind: "accept", frRefs: [], bindings: {} }],
    });
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(ok({ model: m, irHash: ContentHash.reconstitute("a".repeat(64)) })),
      reports,
      solver({ facts: SmtPlanFacts.of(EMPTY_FACTS), result: { kind: "solved", verdicts: SmtQueryVerdicts.of(new Map()) } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("version-mismatch");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target}:${s.reason}`))
      .toEqual(["OB-1:ir-version-mismatch", "SC-1:ir-version-mismatch"]);
    expect(written.ok && written.value.skipped().toArray()[0]?.detail)
      .toBe("IR major version 2 is not supported by this backend (supports 1.x.x)");
    expect(reports.findById(VerificationReportId.of(ap(DIR), "cross-check")).ok).toBe(true);
  });

  test("an unavailable solver writes the degradation with plan skips and the caller exits 127", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const m = model({
      obligations: [
        { id: "OB-1", nature: "invariant", frRefs: [] },
        { id: "OB-2", nature: "state-temporal", frRefs: [] },
      ],
    });
    const facts = SmtPlanFacts.of({
      ...EMPTY_FACTS,
      skipped: VerificationSkips.of([{ target: "OB-2", reason: "capability", detail: 'nature "state-temporal" is checked by a state-machine backend, not the SMT backend' }]),
    });
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(ok({ model: m, irHash: ContentHash.reconstitute("a".repeat(64)) })),
      reports,
      solver({ facts, result: { kind: "unavailable", reason: "no runtime could execute the z3 child process (node: not on PATH)" } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("solver-unavailable");
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.unavailableReason())
      .toBe("no runtime could execute the z3 child process (node: not on PATH)");
    expect(written.ok && written.value.skipped().toArray().map((s) => `${s.target}:${s.reason}`))
      .toEqual(["OB-1:unavailable", "OB-2:capability"]);
    expect(written.ok && written.value.skipped().toArray()[0]?.detail).toBe("z3 could not be executed");
  });

  test("a solved run interprets, persists the conformed report, and converges cross-check", () => {
    const reports = new InMemoryVerificationReportRepository(schema);
    const m = model({
      obligations: [{ id: "OB-1", nature: "invariant", frRefs: ["FR-1"] }],
      scenarios: [{ id: "SC-1", kind: "reject", frRefs: ["FR-2"], bindings: {} }],
    });
    const facts = SmtPlanFacts.of({
      ...EMPTY_FACTS,
      compiled: new Map([["OB-1", true]]),
      labelToTarget: new Map([["ob_OB_1", "OB-1"]]),
      scenarioQueries: new Map([["SC-1", "sc:SC-1"]]),
    });
    const verdicts = new Map<string, SmtQueryVerdict>([
      ["global", { status: "sat", decodedModel: {} }],
      ["sc:SC-1", { status: "sat", decodedModel: { "Ticket.priority": 1 } }],
    ]);
    const outcome = new VerifyRequirementsSmtUseCase(
      formalModels(ok({ model: m, irHash: ContentHash.reconstitute("a".repeat(64)) })),
      reports,
      solver({ facts, result: { kind: "solved", verdicts: SmtQueryVerdicts.of(verdicts) } }),
    ).execute({ modelId: FormalModelId.of(ap("/x")), verifyDirectory: ap(DIR) });
    expect(outcome.kind).toBe("verified");
    expect(outcome.kind === "verified" && outcome.pass).toBe(false);
    expect(outcome.kind === "verified" && outcome.findingsCount).toBe(1);
    const written = reports.findById(VerificationReportId.of(ap(DIR), "smt"));
    expect(written.ok && written.value.findings().toArray()[0]?.kind).toBe("scenario-violation");
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
      { id: "OB-1", nature: "invariant", frRefs: ["FR-1"] },
      { id: "OB-2", nature: "numeric", frRefs: ["FR-2", "FR-1"] },
      { id: "OB-3", nature: "event", frRefs: ["FR-3"] },
      { id: "OB-4", nature: "event", frRefs: ["FR-4"] },
    ],
    scenarios: [
      { id: "SC-1", kind: "accept", frRefs: ["FR-1"], bindings: {} },
      { id: "SC-2", kind: "reject", frRefs: ["FR-2"], bindings: {} },
    ],
  });
  const facts = SmtPlanFacts.of({
    compiled: new Map([["OB-1", true], ["OB-2", true], ["OB-3", true], ["OB-4", true]]),
    skipped: VerificationSkips.of([{ target: "OB-9", reason: "capability", detail: "seed" }]),
    labelToTarget: new Map([["ob_OB_1", "OB-1"], ["ob_OB_2", "OB-2"], ["ty_x", "TY-x"], ["bg_B1", "B1"]]),
    eventPairs: SmtEventPairProbes.of([{ qOverlap: "evo:OB-3:OB-4", qJoint: "evj:OB-3:OB-4", a: "OB-3", b: "OB-4", trigger: "submit" }]),
    gapTriggers: new Map([["submit", ["OB-3", "OB-4"]]]),
    scenarioQueries: new Map([["SC-1", "sc:SC-1"], ["SC-2", "sc:SC-2"]]),
  });
  const run = (entries: [string, SmtQueryVerdict][]) =>
    facts.interpret(twoInvariants, SmtQueryVerdicts.of(new Map(entries)));

  test("global unsat becomes one conflict attributed via the OB-prefixed core labels", () => {
    const { findings, skipped } = run([["global", { status: "unsat", core: ["ty_x", "ob_OB_2", "ob_OB_1"] }]]);
    expect([...findings]).toEqual([{
      kind: "conflict",
      frRefs: ["FR-1", "FR-2"],
      targets: ["OB-1", "OB-2"],
      witness: { core: ["ob_OB_1", "ob_OB_2", "ty_x"] },
      detail: "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.",
    }]);
    expect([...skipped]).toEqual([{ target: "OB-9", reason: "capability", detail: "seed" }]);
  });

  test("global unsat suppresses vacuity findings, and an empty core falls back to all invariants", () => {
    const { findings } = run([
      ["global", { status: "unsat", core: [] }],
      ["vac:OB-1", { status: "unsat", core: ["ob_OB_2"] }],
    ]);
    expect(findings.toArray().length).toBe(1);
    expect(findings.toArray()[0]?.targets).toEqual(["OB-1", "OB-2"]);
  });

  test("a conflict with no effective targets is dropped entirely", () => {
    const bare = model({ obligations: [{ id: "OB-3", nature: "event", frRefs: [] }] });
    const { findings } = SmtPlanFacts.of({ ...EMPTY_FACTS, compiled: new Map([["OB-3", true]]) })
      .interpret(bare, SmtQueryVerdicts.of(new Map([["global", { status: "unsat", core: [] }]])));
    expect([...findings]).toEqual([]);
  });

  test("global timeout skips every compiled invariant", () => {
    const { skipped } = run([["global", { status: "unknown" }]]);
    expect(skipped.toArray().slice(1)).toEqual([
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
    expect(findings.toArray()[0]?.targets).toEqual(["OB-1", "OB-2"]);
    expect(findings.toArray()[0]?.detail).toStartWith("The condition of obligation OB-1 can never hold");
  });

  test("vacuity budget becomes a timeout skip for that obligation", () => {
    const { skipped } = run([["vac:OB-2", { status: "budget" }]]);
    expect(skipped.toArray().slice(1)).toEqual([
      { target: "OB-2", reason: "timeout", detail: "vacuity check for OB-2 exceeded the solver budget" },
    ]);
  });

  test("an overlapping-guards/contradictory-effects pair is a conflict with the frozen wording", () => {
    const { findings } = run([
      ["evo:OB-3:OB-4", { status: "sat" }],
      ["evj:OB-3:OB-4", { status: "unsat", core: [] }],
    ]);
    expect(findings.toArray()[0]?.detail).toBe(
      'Events OB-3 and OB-4 for trigger "submit" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.',
    );
  });

  test("an undecided event pair skips both obligations; a missing half skips nothing", () => {
    const { skipped } = run([
      ["evo:OB-3:OB-4", { status: "sat" }],
      ["evj:OB-3:OB-4", { status: "unknown" }],
    ]);
    expect(skipped.toArray().slice(1).map((s) => s.target)).toEqual(["OB-3", "OB-4"]);
    expect(run([["evo:OB-3:OB-4", { status: "sat" }]]).skipped.toArray().length).toBe(1);
  });

  test("a sat gap query becomes a completeness-gap carrying the decoded witness state", () => {
    const { findings } = run([["gap:submit", { status: "sat", decodedModel: { "Ticket.priority": 2 } }]]);
    expect([...findings]).toEqual([{
      kind: "completeness-gap",
      frRefs: ["FR-3", "FR-4"],
      targets: ["OB-3", "OB-4"],
      witness: { model: { "Ticket.priority": 2 } },
      detail: 'No rule for trigger "submit" applies to the witness state: the behavior of this input region is unspecified.',
    }]);
    expect([...run([["gap:submit", { status: "unsat" }]]).findings]).toEqual([]);
    expect(run([["gap:submit", { status: "error" }]]).skipped.toArray().slice(1).map((s) => s.target)).toEqual(["OB-3", "OB-4"]);
  });

  test("scenario verdicts: accept-unsat and reject-sat violate, undecided skips, missing is silent", () => {
    const { findings } = run([
      ["sc:SC-1", { status: "unsat", core: ["ob_OB_1", "ty_x"] }],
      ["sc:SC-2", { status: "sat", decodedModel: { "Ticket.done": false } }],
    ]);
    expect(findings.toArray().map((f) => f.targets)).toEqual([["OB-1", "SC-1"], ["SC-2"]]);
    expect(findings.toArray()[0]?.witness).toEqual({ core: ["ob_OB_1", "ty_x"] });
    expect(findings.toArray()[1]?.witness).toEqual({ model: { "Ticket.done": false } });
    expect(findings.toArray()[0]?.detail).toStartWith("Accept scenario SC-1 describes a state");
    expect(findings.toArray()[1]?.detail).toStartWith("Reject scenario SC-2 is still satisfiable");
    expect(run([["sc:SC-1", { status: "budget" }]]).skipped.toArray().slice(1).map((s) => s.target)).toEqual(["SC-1"]);
    expect([...run([]).findings]).toEqual([]);
  });
});

describe("cross-check computation", () => {
  const m = model({
    scenarios: [
      { id: "SC-1", kind: "accept", frRefs: ["FR-2", "FR-1"], bindings: {} },
      { id: "SC-2", kind: "reject", frRefs: [], bindings: {} },
    ],
  });
  const id = VerificationReportId.of(ap("/tmp/verify"), "cross-check");
  const sibling = (backend: string, input: {
    irHash?: string;
    unavailable?: string;
    violated?: string[];
    skippedTargets?: string[];
  }): VerificationReport =>
    VerificationReport.reconstitute({
      id: VerificationReportId.of(ap("/tmp/verify"), backend),
      irVersion: IrVersion.reconstitute("1.0.0"),
      irHash: ContentHash.reconstitute(input.irHash ?? "h1"),
      method: "exhaustive",
      findings: VerificationFindings.of((input.violated ?? []).map((t): VerificationFinding => ({
        kind: "scenario-violation",
        frRefs: [],
        targets: [t],
        witness: { core: [] },
        detail: "x",
      }))),
      skipped: VerificationSkips.of((input.skippedTargets ?? []).map((t) => ({ target: t, reason: "capability" }))),
      crossChecked: null,
      unavailableReason: input.unavailable ?? null,
    });

  test("a disagreement yields the frozen finding with the per-backend verdict table", () => {
    const report = VerificationReports.of([sibling("quint", { violated: ["SC-1"] }), sibling("smt", {})]).crossChecked(id, m, ContentHash.reconstitute("h1"));
    expect(report.findings().toArray()).toEqual([{
      kind: "cross-check-disagreement",
      frRefs: ["FR-1", "FR-2"],
      targets: ["SC-1"],
      witness: { verdicts: { quint: "violated", smt: "clean" } },
      detail: 'Backends "quint" and "smt" disagree on scenario SC-1. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.',
    }]);
    expect(report.crossChecked()?.toArray()).toEqual([
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
    ]).crossChecked(id, m, ContentHash.reconstitute("h1"));
    expect(report.findings().toArray()).toEqual([]);
    expect(report.crossChecked()?.toArray()).toEqual([
      { backend: "quint", targets: ["SC-2"] },
      { backend: "smt", targets: ["SC-2"] },
    ]);
  });

  test("fewer than two comparable documents produce an empty cross-check", () => {
    const report = VerificationReports.of([sibling("smt", {})]).crossChecked(id, m, ContentHash.reconstitute("h1"));
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
      irVersion: IrVersion.reconstitute("3.1.4"),
      obligations: [{ id: "OB-2", nature: "invariant", frRefs: [] }],
      scenarios: [{ id: "SC-1", kind: "accept", frRefs: [], bindings: {} }],
    });
    expect(m.supportsMajor(1)).toBe(false);
    expect(m.majorVersion()).toBe(3);
    const vm = VerificationReport.versionMismatch(VerificationReportId.of(ap("/v"), "smt"), m, ContentHash.reconstitute("h"), "exhaustive");
    expect(vm.skipped().toArray().map((s) => s.target)).toEqual(["OB-2", "SC-1"]);
    const su = VerificationReport.solverUnavailable(
      VerificationReportId.of(ap("/v"), "smt"),
      m,
      ContentHash.reconstitute("h"),
      VerificationSkips.of([{ target: "OB-2", reason: "compile-error", detail: "invariant obligation lacks an assert expression" }]),
      "z3-solver is not available in this project: nope",
    );
    expect(su.unavailableReason()).toBe("z3-solver is not available in this project: nope");
    expect(su.skipped().toArray().map((s) => `${s.target}:${s.reason}`)).toEqual(["OB-2:compile-error", "SC-1:unavailable"]);
  });

  test("finding order: kind rank, then joined targets, then detail; unknown kinds sink to rank 9", () => {
    const f = (kind: string, targets: string[], detail: string): VerificationFinding => ({
      kind,
      frRefs: [],
      targets,
      witness: { core: [] },
      detail,
    });
    const sorted = VerificationFindings.of([
      f("mystery", ["X-1"], "z"),
      f("cross-check-disagreement", ["SC-1"], "d"),
      f("scenario-violation", ["SC-2"], "b"),
      f("scenario-violation", ["SC-2"], "a"),
      f("completeness-gap", ["OB-1"], "c"),
      f("conflict", ["OB-1", "OB-2"], "a"),
    ]).sortedCanonically();
    expect(sorted.toArray().map((x) => `${x.kind}:${x.targets.join(",")}:${x.detail}`)).toEqual([
      "conflict:OB-1,OB-2:a",
      "completeness-gap:OB-1:c",
      "scenario-violation:SC-2:a",
      "scenario-violation:SC-2:b",
      "cross-check-disagreement:SC-1:d",
      "mystery:X-1:z",
    ]);
    const skips = VerificationSkips.of([
      { target: "OB-10", reason: "timeout" },
      { target: "OB-2", reason: "unavailable" },
      { target: "OB-2", reason: "capability" },
    ]).sortedCanonically();
    expect(skips.toArray().map((s) => `${s.target}:${s.reason}`)).toEqual([
      "OB-2:capability",
      "OB-2:unavailable",
      "OB-10:timeout",
    ]);
  });

  test("the aggregate composes sorted, degrades empty, and reconstitutes verbatim", () => {
    const id = VerificationReportId.of(ap("/v"), "smt");
    expect(id.equals(VerificationReportId.of(ap("/v"), "smt"))).toBe(true);
    expect(id.equals(VerificationReportId.of(ap("/w"), "smt"))).toBe(false);
    expect(id.fileName()).toBe("smt.json");
    const composed = VerificationReport.compose({
      id,
      irVersion: IrVersion.reconstitute("1.0.0"),
      irHash: ContentHash.reconstitute("h"),
      method: "exhaustive",
      findings: VerificationFindings.of([
        { kind: "scenario-violation", frRefs: [], targets: ["SC-1"], witness: { core: [] }, detail: "b" },
        { kind: "conflict", frRefs: [], targets: ["OB-1"], witness: { core: [] }, detail: "a" },
      ]),
      skipped: VerificationSkips.of([{ target: "OB-2", reason: "timeout" }, { target: "OB-1", reason: "capability" }]),
    });
    expect(composed.findings().toArray().map((x) => x.kind)).toEqual(["conflict", "scenario-violation"]);
    expect(composed.skipped().toArray().map((x) => x.target)).toEqual(["OB-1", "OB-2"]);
    expect(composed.passes()).toBe(false);
    const degraded = composed.degraded("why");
    expect(degraded.unavailableReason()).toBe("why");
    expect(degraded.findings().toArray()).toEqual([]);
    expect(degraded.crossChecked()).toBe(null);
    const back = VerificationReport.reconstitute({
      id,
      irVersion: composed.irVersion(),
      irHash: composed.irHash(),
      method: composed.method(),
      findings: composed.findings(),
      skipped: composed.skipped(),
      crossChecked: null,
      unavailableReason: null,
    });
    expect(back.findings().toArray()).toEqual(composed.findings().toArray());
  });

  test("expressionUsesPrime finds primes only through nested references", () => {
    expect(expressionUsesPrime({ op: "ref", path: "a", prime: true })).toBe(true);
    expect(expressionUsesPrime({
      op: "and",
      args: [{ op: "bool", value: true }, { op: "not", args: [{ op: "ref", path: "a", prime: true }] }],
    })).toBe(true);
    expect(expressionUsesPrime({ op: "eq", args: [{ op: "ref", path: "a" }, { op: "int", value: 1 }] })).toBe(false);
  });

  test("the model resolves targets, references, and attributes as the old free functions did", () => {
    const m = model({
      attributes: [{ path: "Ticket.priority", kind: "int", min: 0, max: 3 }],
      obligations: [
        { id: "OB-2", nature: "invariant", frRefs: ["FR-2"] },
        { id: "OB-1", nature: "event", frRefs: ["FR-1", "FR-2"] },
      ],
      scenarios: [{ id: "SC-1", kind: "accept", frRefs: ["FR-2"], bindings: {} }],
      background: [{ id: "B1", assert: { op: "bool", value: true } }],
    });
    expect(m.allTargets()).toEqual(["OB-1", "OB-2", "SC-1"]);
    expect(m.frRefsOf(["OB-1", "SC-1"])).toEqual(["FR-1", "FR-2"]);
    expect(m.frRefsOf(["nope"])).toEqual([]);
    expect(m.attributeAt("Ticket.priority")?.max).toBe(3);
    expect(m.attributeAt("nope")).toBe(undefined);
    expect(m.attributes().toArray().length).toBe(1);
    expect(m.obligations().toArray().length).toBe(2);
    expect(m.scenarios().toArray().length).toBe(1);
    expect(m.background().toArray()[0]?.id).toBe("B1");
    expect(m.irVersion().asString()).toBe("1.0.0");
    expect(m.supportsMajor(1)).toBe(true);
  });
});

describe("smt facts collections (first-class operations)", () => {
  test("SmtEventPairProbes holds issuance order under add", () => {
    const probe = { qOverlap: "evo:a:b", qJoint: "evj:a:b", a: "OB-1", b: "OB-2", trigger: "go" };
    const probes = SmtEventPairProbes.of([]).add(probe);
    expect([...probes]).toEqual([probe]);
    expect(probes.toArray()).toEqual([probe]);
  });
});
