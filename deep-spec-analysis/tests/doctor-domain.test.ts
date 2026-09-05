import { ArtifactPath } from "@deep-spec/kernel-domain";

// doctor/domain の分岐固定と presenter 文言の凍結ピン（移行 PR9、#22）。
// 判定書の checks 配列順・label/fix の部分文字列（install.ts が grep する
// "no deep-spec verification" / "verification coverage" 等）は観測面。

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DoctorPresenter, DoctorWorkspaceClientImplementation } from "@deep-spec/doctor-adapter";
import {
  ArtifactModifiedAt,
  Check,
  CheckSeverity,
  CoverageAssessment,
  CoverageState,
  DesignArtifactReference,
  DesignArtifacts,
  DigestAnchor,
  FindingCount,
  FunctionalObservation,
  FunctionalUnitObservation,
  HealthVerdict,
  InstallationManifest,
  InstalledStatus,
  IntentLocation,
  ManifestEntry,
  SolverAvailability,
  StageScope,
  StageScopes,
  StructuralDebt,
  StructuralObservation,
  UnitCoverage,
  VerificationObservation,
  VerificationStaleness,
} from "@deep-spec/doctor-domain";
import type { DoctorWorkspaceClient } from "@deep-spec/doctor-usecase";
import {
  CheckFunctionalCoverageUseCase,
  CheckInstallationUseCase,
  CheckStructuralDebtUseCase,
  CheckVerificationCoverageUseCase,
} from "@deep-spec/doctor-usecase";
import { ContentHash, UnitName } from "@deep-spec/kernel-domain";
import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";

const location = (intent: string) => IntentLocation.of(ArtifactPath.of("default"), ArtifactPath.of(intent));
const scopes = (...names: string[]) => StageScopes.of(names.map((name) => StageScope.of(name)));
const artifact = (relative: string) =>
  DesignArtifactReference.of({
    location: location("i1"),
    tool: ArtifactPath.of("refcheck.ts"),
    artifactPath: ArtifactPath.of(`/project/${relative}`),
    relativePath: ArtifactPath.of(relative),
  });
const debtObservation = (relative: string, count: number | null) =>
  StructuralObservation.of(artifact(relative), count === null ? null : FindingCount.of(count));
const units = (...entries: readonly [string, number][]) =>
  entries.map(([name, modifiedAt]) =>
    FunctionalUnitObservation.of(UnitName.of(name), ArtifactModifiedAt.of(modifiedAt)),
  );
const names = (...values: string[]) => values.map((value) => UnitName.of(value));
const functional = (
  intent: string,
  values: readonly FunctionalUnitObservation[],
  modelUnits: readonly UnitName[],
  completedUnits: readonly UnitName[],
  requirementsModifiedAt: number | null = null,
) =>
  FunctionalObservation.of({
    location: location(intent),
    units: values,
    modelModifiedAt: ArtifactModifiedAt.of(100),
    modelUnits,
    completedUnits,
    hasFindings: true,
    requirementsModelModifiedAt: requirementsModifiedAt === null ? null : ArtifactModifiedAt.of(requirementsModifiedAt),
  });
const observed = (intent: string, hasModel: boolean, hasFindings: boolean, anchor: DigestAnchor | null) =>
  VerificationObservation.of({ location: location(intent), hasModel, hasFindings, anchor });

const h = (text: string): ContentHash => ContentHash.ofText(text);

describe("installation manifest", () => {
  test("the ledger carries every composed file in the frozen order", () => {
    const entries: ManifestEntry[] = [...InstallationManifest.standard()];
    // 出荷形（sensors 9 + entry バンドル 10 + data/ 4 + knowledge 3）。層ツリーの
    // canary は配布物に存在しないので台帳からも消えている。
    expect(entries).toHaveLength(26);
    expect(entries[0]?.rel()).toBe("sensors/aidlc-deep-spec-ir-valid.md");
    expect(entries[0]?.severity().asString()).toBe("error");
    expect(entries[0]?.severity().blocksDoctor()).toBe(true);
    expect(entries[entries.length - 1]?.rel()).toBe(
      "knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md",
    );
    const rels = entries.map((e) => e.rel());
    expect(rels).toContain("tools/deep-spec-analysis-doctor.ts");
    // 台帳は tools/ 直下のバンドルと data/ しか見ない——層ディレクトリは出荷しない。
    // バンドルのファイル名は .ts のまま（上流ディスパッチャが .ts を要求する）。
    expect(rels.filter((r) => r.startsWith("tools/") && r.endsWith(".ts"))).toHaveLength(10);
    expect(rels.filter((r) => r.startsWith("tools/data/"))).toHaveLength(4);
    expect(rels.some((r) => r.endsWith(".js"))).toBe(false);
    // 層ディレクトリの canary（tools/<layer>/... ）は 1 行も残っていない。
    expect(
      rels.filter(
        (r) => r.startsWith("tools/") && r.slice("tools/".length).includes("/") && !r.startsWith("tools/data/"),
      ),
    ).toHaveLength(0);
    expect(entries.every((e) => e.severity().blocksDoctor())).toBe(true);
  });
});

describe("verification staleness — sourceDigest 照合と mtime フォールバックの純粋判断", () => {
  test("an anchor decides by content, never by mtime", () => {
    expect(VerificationStaleness.of({ anchor: DigestAnchor.of(h("a"), h("b")) }).isStale()).toBe(true);
    expect(VerificationStaleness.of({ anchor: DigestAnchor.of(h("a"), h("a")) }).isStale()).toBe(false);
  });

  test("a model without an anchor is unconditionally stale (backward-compat mtime heuristic removed)", () => {
    expect(VerificationStaleness.of({ anchor: null }).isStale()).toBe(true);
  });
});

describe("assessment aggregates", () => {
  test("coverage assessment counts verified against eligible", () => {
    const a = CoverageAssessment.of(
      [
        observed("i1", false, false, null),
        observed("i2", true, true, DigestAnchor.of(h("same"), h("same"))),
        observed("i3", true, true, DigestAnchor.of(h("same"), h("same"))),
      ],
      scopes("enterprise", "feature"),
    );
    expect(a.isClean()).toBe(false);
    expect(a.verifiedCount()).toBe(2);
    expect(a.eligibleCount()).toBe(3);
    expect(a.problems()).toHaveLength(1);
    expect([...a.scopes()].map((scope) => scope.asString()).join(", ")).toBe("enterprise, feature");
    expect(CoverageAssessment.of([], scopes()).isClean()).toBe(true);
  });

  test("structural debt excludes unmeasured artifacts and totals findings", () => {
    const d = StructuralDebt.of([
      debtObservation("inception/domain-design/components.md", 3),
      debtObservation("construction/u1/functional-design", 2),
      debtObservation("inception/contract-design/contract-summary.md", null),
    ]);
    expect(d.hasScans()).toBe(true);
    expect(d.scannedCount()).toBe(2);
    expect(d.totalFindings()).toBe(5);
    expect(d.rows()).toHaveLength(2);
    expect(StructuralDebt.of([]).hasScans()).toBe(false);
  });

  test("unit coverage derives completion and refinement staleness from observations", () => {
    const u = UnitCoverage.of(
      [
        functional(
          "i1",
          units(["u1", 150], ["u2", 50], ["u3", 50]),
          names("u1", "u2", "u3"),
          names("u1", "u2", "u3"),
          200,
        ),
      ],
      scopes("feature"),
    );
    expect(u.hasEligible()).toBe(true);
    expect(u.isClean()).toBe(false);
    expect(u.verifiedCount()).toBe(2);
    expect(u.eligibleCount()).toBe(3);
    expect(u.problems()).toHaveLength(1);
    expect(u.refinementStale()).toHaveLength(1);
    expect([...u.scopes()].map((scope) => scope.asString())).toEqual(["feature"]);
    expect(UnitCoverage.of([], scopes()).hasEligible()).toBe(false);
    expect(UnitCoverage.of([], scopes()).isClean()).toBe(true);
  });

  test("the health verdict keeps the frozen checks order and serialized shape", () => {
    const row: Check = Check.of({ pass: true, label: "l", fix: "f", severity: CheckSeverity.advisory() });
    const v = HealthVerdict.of([row]).add(
      Check.of({ pass: false, label: "m", fix: "g", severity: CheckSeverity.error() }),
    );
    expect([...v].map((c) => c.label())).toEqual(["l", "m"]);
    expect(row.passes()).toBe(true);
    expect(row.fix()).toBe("f");
    expect(Check.of({ pass: true, label: "n", severity: CheckSeverity.advisory() }).toDocument()).toEqual({
      pass: true,
      label: "n",
      severity: "advisory",
    });
    expect(JSON.stringify(v.document())).toBe(
      '{"checks":[{"pass":true,"label":"l","fix":"f","severity":"advisory"},{"pass":false,"label":"m","fix":"g","severity":"error"}]}',
    );
  });
});

describe("presenter — 凍結文言のピン（installer が grep する部分文字列を含む）", () => {
  const presenter = new DoctorPresenter({ harnessDir: ".claude" });

  test("manifest and solver rows render the legacy bytes", () => {
    const rows = presenter.installation([
      InstalledStatus.of(ManifestEntry.error(ArtifactPath.of("sensors/aidlc-deep-spec-ir-valid.md")), false),
    ]);
    expect(rows[0]?.toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: sensors/aidlc-deep-spec-ir-valid.md installed",
      fix: "Run `bun .claude/tools/aidlc-utility.ts plugin-sync` (or re-run the plugin's `hooks/compose.ts`).",
      severity: "error",
    });
    const solvers = presenter.solvers(
      SolverAvailability.of({
        z3Package: true,
        nodeRuntime: false,
        quintCli: true,
        apalache: false,
        apalacheServerStale: false,
      }),
    );
    expect(solvers.map((c) => [c.passes(), c.label()])).toEqual([
      [true, "deep-spec-analysis: z3-solver package present (SMT backend)"],
      [false, "deep-spec-analysis: node runtime on PATH (executes the z3 child process)"],
      [true, "deep-spec-analysis: quint CLI on PATH (Quint backend)"],
      [false, "deep-spec-analysis: Apalache available (quint verify, method: bounded)"],
    ]);
    expect(solvers.every((c) => c.severity().isAdvisory())).toBe(true);
    expect(CheckSeverity.advisory().equals(CheckSeverity.advisory())).toBe(true);
    expect(CheckSeverity.advisory().equals(CheckSeverity.error())).toBe(false);
  });

  // issue #128: 配布物と JDK が在っても、8822 番の孤児サーバが消えた作業
  // ディレクトリを掴んでいれば verify は落ちる。Apalache 行はその区別を語る。
  test("a stale Apalache server fails the Apalache row and swaps the fix for how to stop it", () => {
    const stale = SolverAvailability.of({
      z3Package: true,
      nodeRuntime: true,
      quintCli: true,
      apalache: true,
      apalacheServerStale: true,
    });
    expect(stale.apalacheServerIsStale()).toBe(true);
    expect(stale.hasApalache()).toBe(false);
    const row = presenter.solvers(stale)[3];
    expect(row?.passes()).toBe(false);
    expect(row?.label()).toBe("deep-spec-analysis: Apalache available (quint verify, method: bounded)");
    expect(row?.fix()).toBe(
      "An Apalache server is listening on localhost:8822 but cannot verify — typically an orphan that still holds a deleted working directory. " +
        "Stop it (`lsof -nP -iTCP:8822 -sTCP:LISTEN` shows the PID, then `kill <pid>`); quint starts a fresh server on the next `quint verify`.",
    );
    expect(row?.severity().isAdvisory()).toBe(true);
  });

  test("a healthy Apalache passes the row and keeps the frozen install fix", () => {
    const healthy = SolverAvailability.of({
      z3Package: true,
      nodeRuntime: true,
      quintCli: true,
      apalache: true,
      apalacheServerStale: false,
    });
    expect(healthy.apalacheServerIsStale()).toBe(false);
    expect(healthy.hasApalache()).toBe(true);
    const row = presenter.solvers(healthy)[3];
    expect(row?.passes()).toBe(true);
    expect(row?.fix()).toBe(
      "Install a JDK (17+) and run any `quint verify` once so quint downloads its Apalache distribution into ~/.quint (or set APALACHE_DIST). " +
        "Without it the Quint backend uses seeded simulation (method: simulation) and skips leads-to temporal obligations.",
    );
  });

  test("coverage rows carry the grep-frozen nouns and the summary carries the scope list", () => {
    const rows = presenter.verificationCoverage(
      CoverageAssessment.of(
        [observed("i1", false, false, null), observed("i2", true, true, null)],
        scopes("enterprise", "feature"),
      ),
    );
    expect(rows[0]?.label()).toBe(
      "deep-spec-analysis: intent default/i1 has requirements with no deep-spec verification",
    );
    expect(rows[1]?.label()).toBe(
      "deep-spec-analysis: intent default/i2 changed its requirements after the last deep-spec verification",
    );
    expect(rows[0]?.fix()).toBe(
      "Make it the active intent (`bun .claude/tools/aidlc-utility.ts intent i1`), " +
        "then run `/aidlc --stage deep-spec-analysis-verify --single` to verify its requirements without advancing the workflow.",
    );
    expect(rows[2]?.toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: verification coverage — 0/2 eligible intents verified (scopes: enterprise, feature)",
      fix: "See the per-intent rows above for the exact command each unverified intent needs.",
      severity: "advisory",
    });
  });

  test("debt rows and the report-only summary render the legacy bytes; no scans, no summary", () => {
    const rows = presenter.structuralDebt(
      StructuralDebt.of([
        debtObservation("inception/domain-design/components.md", 4),
        debtObservation("inception/contract-design/contract-summary.md", 0),
        debtObservation("construction/u1/functional-design", 0),
      ]),
    );
    expect(rows[0]?.label()).toBe(
      "deep-spec-analysis: default/i1 inception/domain-design/components.md has 4 reference-integrity finding(s)",
    );
    expect(rows[1]?.label()).toBe(
      "deep-spec-analysis: design refcheck — 4 structural finding(s) across 3 design artifact(s) scanned (report-only)",
    );
    expect(presenter.structuralDebt(StructuralDebt.of([]))).toHaveLength(0);
  });

  test("functional rows keep the frozen order: refinement staleness, then units, then the summary", () => {
    const rows = presenter.functionalCoverage(
      UnitCoverage.of(
        [functional("i1", units(["u1", 50], ["u2", 150]), names("u2"), names("u2"), 200)],
        scopes("feature"),
      ),
    );
    expect(rows.map((c) => c.label())).toEqual([
      "deep-spec-analysis: intent default/i1 re-verified its requirements after the last design verification (refinement evidence is stale)",
      "deep-spec-analysis: unit default/i1/u1 has functional-design artifacts with no deep-spec design verification",
      "deep-spec-analysis: unit default/i1/u2 changed its functional-design artifacts after the last design verification",
      "deep-spec-analysis: design verification coverage — 0/2 eligible units verified (scopes: feature)",
    ]);
    expect(presenter.functionalCoverage(UnitCoverage.of([], scopes()))).toHaveLength(0);
  });
});

describe("doctor flow and observation ownership", () => {
  test("unit completion requires both the model ledger and backend checked evidence", () => {
    const coverage = UnitCoverage.of(
      [
        functional(
          "i1",
          units(["u1", 50], ["u2", 150], ["u3", 50], ["u4", 50]),
          names("u1", "u2", "u4"),
          names("u1", "u2", "u3"),
          200,
        ),
      ],
      scopes("feature"),
    );
    const repo: DoctorWorkspaceClient = {
      verificationCoverage: () => CoverageAssessment.of([], scopes()),
      functionalCoverage: () => coverage,
      designArtifacts: () => DesignArtifacts.of([]),
    };
    const out = new CheckFunctionalCoverageUseCase(repo).execute();
    expect(
      out
        .problems()
        .map((row) => [
          row.unit().asString(),
          row.matchState({ unverified: () => "unverified", stale: () => "stale" }),
        ]),
    ).toEqual([
      ["u2", "stale"],
      ["u3", "unverified"],
      ["u4", "unverified"],
    ]);
    expect(out.problems().map((row) => row.location().intent().asString())).toEqual(["i1", "i1", "i1"]);
    expect(CoverageState.stale().equals(CoverageState.stale())).toBe(true);
    expect(CoverageState.stale().equals(CoverageState.unverified())).toBe(false);
    expect(out.refinementStale().map((place) => [place.space().asString(), place.intent().asString()])).toEqual([
      ["default", "i1"],
    ]);
    expect(out.eligibleCount()).toBe(4);
    expect(new CheckVerificationCoverageUseCase(repo).execute().eligibleCount()).toBe(0);
  });

  test("installation and structural checks pass domain references unchanged to ports", () => {
    const installed: string[] = [];
    const statuses = new CheckInstallationUseCase({
      isInstalled: (entry) => {
        installed.push(entry.rel());
        return true;
      },
    }).execute();
    expect(installed).toHaveLength(26);
    expect(statuses.every((status) => status.isPresent())).toBe(true);
    const targets = DesignArtifacts.of([artifact("a"), artifact("b"), artifact("c")]);
    const requested: string[] = [];
    const out = new CheckStructuralDebtUseCase(
      {
        verificationCoverage: () => CoverageAssessment.of([], scopes()),
        functionalCoverage: () => UnitCoverage.of([], scopes()),
        designArtifacts: () => targets,
      },
      {
        observe: (target) => {
          requested.push(target.relativePath().asString());
          return StructuralObservation.of(
            target,
            requested.length === 2 ? null : FindingCount.of(requested.length === 1 ? 2 : 0),
          );
        },
      },
    ).execute();
    expect(requested).toEqual(["a", "b", "c"]);
    expect(out.scannedCount()).toBe(2);
    expect(out.totalFindings()).toBe(2);
  });
});

describe("doctor observation construction contracts", () => {
  test("scope origin is selected by the workspace boundary; names enforce size then lexical syntax", () => {
    expect(StageScope.parse("feature").ok).toBe(true);
    expect(StageScope.of("feature").equals(StageScope.of("feature"))).toBe(true);
    expect(StageScope.of("feature").equals(StageScope.of("enterprise"))).toBe(false);
    expect(StageScope.of("a".repeat(128)).asString()).toHaveLength(128);
    for (const raw of ["", "a".repeat(129), "feature\n", "fea ture", "Ｆeature", "-feature"]) {
      expect(() => StageScope.of(raw)).toThrow(IllegalArgumentException);
      const result = StageScope.parse(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).not.toBeInstanceOf(Error);
    }
    const accepted = StageScopes.parse([StageScope.of("feature")]);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.value.includes(StageScope.of("feature"))).toBe(true);
      expect(accepted.value.includes(StageScope.of("enterprise"))).toBe(false);
    }
    expect([...StageScopes.of(Array(1024).fill(StageScope.of("feature")))]).toHaveLength(1024);
    const oversized = Array(1025).fill(StageScope.of("feature"));
    expect(() => StageScopes.of(oversized)).toThrow(IllegalArgumentException);
    expect(StageScopes.parse(oversized).ok).toBe(false);
  });

  test("numeric observations reject non-finite and out-of-budget values through of and parse", () => {
    expect(ArtifactModifiedAt.of(1.5).isAfter(ArtifactModifiedAt.of(-1))).toBe(true);
    expect(ArtifactModifiedAt.of(1).isAfter(ArtifactModifiedAt.of(1))).toBe(false);
    expect(ArtifactModifiedAt.parse(Number.MAX_SAFE_INTEGER).ok).toBe(true);
    for (const raw of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => ArtifactModifiedAt.of(raw)).toThrow(IllegalArgumentException);
      const parsed = ArtifactModifiedAt.parse(raw);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
    }
    expect(FindingCount.parse(1_000_000).ok).toBe(true);
    expect(FindingCount.of(1_000_000).asNumber()).toBe(1_000_000);
    for (const raw of [-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
      expect(() => FindingCount.of(raw)).toThrow(IllegalArgumentException);
      const parsed = FindingCount.parse(raw);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
    }
  });

  test("observation collections enforce their own count budgets and retain input ownership", () => {
    const verification = observed("i1", true, false, null);
    const source = [verification];
    const coverage = CoverageAssessment.of(source, scopes());
    source.length = 0;
    expect(coverage.eligibleCount()).toBe(1);
    expect(coverage.verifiedCount()).toBe(0);
    expect(CoverageAssessment.parse([verification], scopes()).ok).toBe(true);
    expect(CoverageAssessment.of(Array(65_536).fill(verification), scopes()).eligibleCount()).toBe(65_536);
    expect(() => CoverageAssessment.of(Array(65_537).fill(verification), scopes())).toThrow(IllegalArgumentException);
    expect(CoverageAssessment.parse(Array(65_537).fill(verification), scopes()).ok).toBe(false);

    const unitSource = units(["u1", 50]);
    const input = {
      location: location("i1"),
      units: unitSource,
      modelModifiedAt: ArtifactModifiedAt.of(100),
      modelUnits: names("u1"),
      completedUnits: names("u1"),
      hasFindings: true,
      requirementsModelModifiedAt: null,
    };
    const intent = FunctionalObservation.of(input);
    unitSource.length = 0;
    input.modelUnits.length = 0;
    input.completedUnits.length = 0;
    expect(intent.eligibleCount()).toBe(1);
    expect(intent.problems()).toHaveLength(0);
    expect(intent.refinementIsStale()).toBe(false);
    expect(FunctionalObservation.parse(input).ok).toBe(true);
    for (const oversized of [
      {
        ...input,
        units: Array(65_537).fill(FunctionalUnitObservation.of(UnitName.of("u1"), ArtifactModifiedAt.of(1))),
      },
      { ...input, modelUnits: Array(65_537).fill(UnitName.of("u1")) },
      { ...input, completedUnits: Array(65_537).fill(UnitName.of("u1")) },
    ]) {
      expect(() => FunctionalObservation.of(oversized)).toThrow(IllegalArgumentException);
      expect(FunctionalObservation.parse(oversized).ok).toBe(false);
    }
    expect(UnitCoverage.parse([intent], scopes()).ok).toBe(true);
    expect(UnitCoverage.of(Array(65_536).fill(intent), scopes()).eligibleCount()).toBe(65_536);
    expect(() => UnitCoverage.of(Array(65_537).fill(intent), scopes())).toThrow(IllegalArgumentException);
    expect(UnitCoverage.parse(Array(65_537).fill(intent), scopes()).ok).toBe(false);
    const largeIntent = FunctionalObservation.of({
      ...input,
      units: Array(32_769).fill(FunctionalUnitObservation.of(UnitName.of("u1"), ArtifactModifiedAt.of(1))),
    });
    expect(() => UnitCoverage.of([largeIntent, largeIntent], scopes())).toThrow(IllegalArgumentException);
    expect(UnitCoverage.parse([largeIntent, largeIntent], scopes()).ok).toBe(false);
    const withoutEvidence = FunctionalObservation.of({
      ...input,
      units: units(["u1", 150]),
      hasFindings: false,
      modelModifiedAt: null,
    });
    expect(withoutEvidence.problems()[0]?.matchState({ unverified: () => true, stale: () => false })).toBe(true);
    expect(withoutEvidence.refinementIsStale()).toBe(false);

    const reference = artifact("components.md");
    expect(DesignArtifacts.parse([reference]).ok).toBe(true);
    expect([...DesignArtifacts.of(Array(65_536).fill(reference))]).toHaveLength(65_536);
    expect(() => DesignArtifacts.of(Array(65_537).fill(reference))).toThrow(IllegalArgumentException);
    expect(DesignArtifacts.parse(Array(65_537).fill(reference)).ok).toBe(false);
    const observation = StructuralObservation.of(reference, FindingCount.of(0));
    expect(StructuralDebt.parse([observation]).ok).toBe(true);
    expect(StructuralDebt.of(Array(65_536).fill(observation)).scannedCount()).toBe(65_536);
    expect(() => StructuralDebt.of(Array(65_537).fill(observation))).toThrow(IllegalArgumentException);
    expect(StructuralDebt.parse(Array(65_537).fill(observation)).ok).toBe(false);
    expect(reference.tool().asString()).toBe("refcheck.ts");
    expect(reference.artifactPath().asString()).toBe("/project/components.md");
  });
});

describe("workspace timestamp observation", () => {
  test("epoch and pre-epoch model timestamps remain present and keep evidence-based coverage", () => {
    const project = mkdtempSync(join(tmpdir(), "doctor-observed-model-"));
    const record = join(project, "aidlc", "spaces", "default", "intents", "i1");
    const unitDirectory = join(record, "construction", "u1", "functional-design");
    const stageDirectory = join(record, "construction", "deep-spec-analysis-functional-verify");
    const findingsDirectory = join(stageDirectory, "deep-spec-design-verify");
    try {
      mkdirSync(unitDirectory, { recursive: true });
      mkdirSync(findingsDirectory, { recursive: true });
      writeFileSync(join(record, "aidlc-state.md"), "- **Scope**: feature\n");
      const artifactPath = join(unitDirectory, "entities.md");
      writeFileSync(artifactPath, "entities\n");
      utimesSync(artifactPath, new Date(0), new Date(0));
      const modelPath = join(stageDirectory, "deep-spec-analysis-functional-formal-model.md");
      writeFileSync(modelPath, '```json\n{"units":[{"unit":"u1"}]}\n```\n');
      const findingsPath = join(findingsDirectory, "quint.json");
      writeFileSync(findingsPath, JSON.stringify({ checked: ["unit:u1"] }));
      const workspace = new DoctorWorkspaceClientImplementation({
        projectDir: project,
        root: join(project, ".claude"),
        refcheckToolNames: { domain: "domain.ts", contract: "contract.ts", functional: "functional.ts" },
      });
      utimesSync(modelPath, new Date(0), new Date(0));
      expect(workspace.functionalCoverage().verifiedCount()).toBe(1);
      expect(workspace.functionalCoverage().problems()).toHaveLength(0);

      utimesSync(modelPath, new Date(-1000), new Date(-1000));
      const preEpoch = workspace.functionalCoverage();
      expect(preEpoch.eligibleCount()).toBe(1);
      expect(
        preEpoch
          .problems()
          .map((problem) => problem.matchState({ stale: () => "stale", unverified: () => "unverified" })),
      ).toEqual(["stale"]);

      writeFileSync(findingsPath, JSON.stringify({ checked: [] }));
      expect(
        workspace
          .functionalCoverage()
          .problems()
          .map((problem) => problem.matchState({ stale: () => "stale", unverified: () => "unverified" })),
      ).toEqual(["unverified"]);
      rmSync(modelPath);
      expect(
        workspace
          .functionalCoverage()
          .problems()
          .map((problem) => problem.matchState({ stale: () => "stale", unverified: () => "unverified" })),
      ).toEqual(["unverified"]);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});

test("invalid or oversized authored stage scopes use the default range without constructor panics", () => {
  const project = mkdtempSync(join(tmpdir(), "doctor-stage-scopes-"));
  const root = join(project, ".claude");
  const stageRoot = join(root, "aidlc-common", "stages");
  try {
    mkdirSync(join(stageRoot, "inception"), { recursive: true });
    mkdirSync(join(stageRoot, "construction"), { recursive: true });
    const workspace = new DoctorWorkspaceClientImplementation({
      projectDir: project,
      root,
      refcheckToolNames: { domain: "domain.ts", contract: "contract.ts", functional: "functional.ts" },
    });
    const cases = [
      { authored: ["Invalid"], expected: ["enterprise", "feature"] },
      { authored: ["a".repeat(129)], expected: ["enterprise", "feature"] },
      { authored: Array(1025).fill("feature"), expected: ["enterprise", "feature"] },
      { authored: ["refactor"], expected: ["refactor"] },
    ];
    for (const { authored, expected } of cases) {
      const frontmatter = `---\nscopes:\n${authored.map((scope) => `  - ${scope}\n`).join("")}name: audit-stage\n---\n`;
      writeFileSync(join(stageRoot, "inception", "deep-spec-analysis-verify.md"), frontmatter);
      writeFileSync(join(stageRoot, "construction", "deep-spec-analysis-functional-verify.md"), frontmatter);
      expect([...workspace.verificationCoverage().scopes()].map((scope) => scope.asString())).toEqual(expected);
      expect([...workspace.functionalCoverage().scopes()].map((scope) => scope.asString())).toEqual(expected);
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
