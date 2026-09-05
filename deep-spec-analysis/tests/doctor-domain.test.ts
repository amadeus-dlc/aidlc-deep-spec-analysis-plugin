// doctor/domain の分岐固定と presenter 文言の凍結ピン（移行 PR9、#22）。
// 判定書の checks 配列順・label/fix の部分文字列（install.ts が grep する
// "no deep-spec verification" / "verification coverage" 等）は観測面。

import { HealthVerdict, InstallationManifest, VerificationStaleness, CheckSeverity, CoverageState, Check, DigestAnchor, InstalledStatus, ManifestEntry, SolverAvailability } from "@deep-spec/doctor-domain";
import { CoverageRow, DebtRow, RefinementStaleRow, UnitCoverageRow, CoverageAssessment, StructuralDebt, UnitCoverage, CheckFunctionalCoverageUseCase } from "@deep-spec/doctor-usecase";
import type { DoctorWorkspaceClient } from "@deep-spec/doctor-usecase";
import { describe, expect, test } from "bun:test";
import { ContentHash } from "@deep-spec/kernel-domain";

import { DoctorPresenter } from "@deep-spec/doctor-adapter";

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
    expect(entries[entries.length - 1]?.rel()).toBe("knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md");
    const rels = entries.map((e) => e.rel());
    expect(rels).toContain("tools/deep-spec-analysis-doctor.ts");
    // 台帳は tools/ 直下のバンドルと data/ しか見ない——層ディレクトリは出荷しない。
    // バンドルのファイル名は .ts のまま（上流ディスパッチャが .ts を要求する）。
    expect(rels.filter((r) => r.startsWith("tools/") && r.endsWith(".ts"))).toHaveLength(10);
    expect(rels.filter((r) => r.startsWith("tools/data/"))).toHaveLength(4);
    expect(rels.some((r) => r.endsWith(".js"))).toBe(false);
    // 層ディレクトリの canary（tools/<layer>/... ）は 1 行も残っていない。
    expect(rels.filter((r) => r.startsWith("tools/") && r.slice("tools/".length).includes("/") && !r.startsWith("tools/data/"))).toHaveLength(0);
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
    const a = CoverageAssessment.of({
      eligible: 3,
      problems: [CoverageRow.of({ space: "default", intent: "i1", state: CoverageState.unverified() })],
      scopes: ["enterprise", "feature"],
    });
    expect(a.isClean()).toBe(false);
    expect(a.verifiedCount()).toBe(2);
    expect(a.eligibleCount()).toBe(3);
    expect(a.problems()).toHaveLength(1);
    expect(a.scopes().join(", ")).toBe("enterprise, feature");
    expect(CoverageAssessment.of({ eligible: 0, problems: [], scopes: [] }).isClean()).toBe(true);
  });

  test("structural debt totals findings across scanned artifacts", () => {
    const d = StructuralDebt.of({
      scanned: 2,
      rows: [
        DebtRow.of({ space: "default", intent: "i1", artifact: "inception/domain-design/components.md", findings: 3 }),
        DebtRow.of({ space: "default", intent: "i1", artifact: "construction/u1/functional-design", findings: 2 }),
      ],
    });
    expect(d.hasScans()).toBe(true);
    expect(d.scannedCount()).toBe(2);
    expect(d.totalFindings()).toBe(5);
    expect(d.rows()).toHaveLength(2);
    expect(StructuralDebt.of({ scanned: 0, rows: [] }).hasScans()).toBe(false);
  });

  test("unit coverage carries unit problems and refinement staleness apart", () => {
    const u = UnitCoverage.of({
      eligible: 3,
      problems: [UnitCoverageRow.of({ space: "default", intent: "i1", unit: "u1", state: CoverageState.stale() })],
      refinementStale: [RefinementStaleRow.of({ space: "default", intent: "i1" })],
      scopes: ["feature"],
    });
    expect(u.hasEligible()).toBe(true);
    expect(u.isClean()).toBe(false);
    expect(u.verifiedCount()).toBe(2);
    expect(u.eligibleCount()).toBe(3);
    expect(u.problems()).toHaveLength(1);
    expect(u.refinementStale()).toHaveLength(1);
    expect(u.scopes()).toEqual(["feature"]);
    expect(UnitCoverage.of({ eligible: 0, problems: [], refinementStale: [], scopes: [] }).hasEligible()).toBe(false);
    expect(UnitCoverage.of({ eligible: 0, problems: [], refinementStale: [], scopes: [] }).isClean()).toBe(true);
  });

  test("the health verdict keeps the frozen checks order and serialized shape", () => {
    const row: Check = Check.of({ pass: true, label: "l", fix: "f", severity: CheckSeverity.advisory() });
    const v = HealthVerdict.of([row]).add(Check.of({ pass: false, label: "m", fix: "g", severity: CheckSeverity.error() }));
    expect([...v].map((c) => c.label())).toEqual(["l", "m"]);
    expect(row.passes()).toBe(true);
    expect(row.fix()).toBe("f");
    expect(Check.of({ pass: true, label: "n", severity: CheckSeverity.advisory() }).toDocument()).toEqual({ pass: true, label: "n", severity: "advisory" });
    expect(JSON.stringify(v.document())).toBe(
      '{"checks":[{"pass":true,"label":"l","fix":"f","severity":"advisory"},{"pass":false,"label":"m","fix":"g","severity":"error"}]}',
    );
  });
});

describe("presenter — 凍結文言のピン（installer が grep する部分文字列を含む）", () => {
  const presenter = new DoctorPresenter({ harnessDir: ".claude" });

  test("manifest and solver rows render the legacy bytes", () => {
    const rows = presenter.installation([InstalledStatus.of(ManifestEntry.error("sensors/aidlc-deep-spec-ir-valid.md"), false)]);
    expect(rows[0]?.toDocument()).toEqual({
      pass: false,
      label: "deep-spec-analysis: sensors/aidlc-deep-spec-ir-valid.md installed",
      fix: "Run `bun .claude/tools/aidlc-utility.ts plugin-sync` (or re-run the plugin's `hooks/compose.ts`).",
      severity: "error",
    });
    const solvers = presenter.solvers(SolverAvailability.of({ z3Package: true, nodeRuntime: false, quintCli: true, apalache: false, apalacheServerStale: false }));
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
    const stale = SolverAvailability.of({ z3Package: true, nodeRuntime: true, quintCli: true, apalache: true, apalacheServerStale: true });
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
    const healthy = SolverAvailability.of({ z3Package: true, nodeRuntime: true, quintCli: true, apalache: true, apalacheServerStale: false });
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
    const rows = presenter.verificationCoverage(CoverageAssessment.of({
      eligible: 2,
      problems: [
        CoverageRow.of({ space: "default", intent: "i1", state: CoverageState.unverified() }),
        CoverageRow.of({ space: "default", intent: "i2", state: CoverageState.stale() }),
      ],
      scopes: ["enterprise", "feature"],
    }));
    expect(rows[0]?.label()).toBe("deep-spec-analysis: intent default/i1 has requirements with no deep-spec verification");
    expect(rows[1]?.label()).toBe("deep-spec-analysis: intent default/i2 changed its requirements after the last deep-spec verification");
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
    const rows = presenter.structuralDebt(StructuralDebt.of({
      scanned: 3,
      rows: [DebtRow.of({ space: "default", intent: "i1", artifact: "inception/domain-design/components.md", findings: 4 })],
    }));
    expect(rows[0]?.label()).toBe("deep-spec-analysis: default/i1 inception/domain-design/components.md has 4 reference-integrity finding(s)");
    expect(rows[1]?.label()).toBe("deep-spec-analysis: design refcheck — 4 structural finding(s) across 3 design artifact(s) scanned (report-only)");
    expect(presenter.structuralDebt(StructuralDebt.of({ scanned: 0, rows: [] }))).toHaveLength(0);
  });

  test("functional rows keep the frozen order: refinement staleness, then units, then the summary", () => {
    const rows = presenter.functionalCoverage(UnitCoverage.of({
      eligible: 2,
      problems: [
        UnitCoverageRow.of({ space: "default", intent: "i1", unit: "u1", state: CoverageState.unverified() }),
        UnitCoverageRow.of({ space: "default", intent: "i1", unit: "u2", state: CoverageState.stale() }),
      ],
      refinementStale: [RefinementStaleRow.of({ space: "default", intent: "i1" })],
      scopes: ["feature"],
    }));
    expect(rows.map((c) => c.label())).toEqual([
      "deep-spec-analysis: intent default/i1 re-verified its requirements after the last design verification (refinement evidence is stale)",
      "deep-spec-analysis: unit default/i1/u1 has functional-design artifacts with no deep-spec design verification",
      "deep-spec-analysis: unit default/i1/u2 changed its functional-design artifacts after the last design verification",
      "deep-spec-analysis: design verification coverage — 0/2 eligible units verified (scopes: feature)",
    ]);
    expect(presenter.functionalCoverage(UnitCoverage.of({ eligible: 0, problems: [], refinementStale: [], scopes: [] }))).toHaveLength(0);
  });
});

describe("functional-coverage interactor — 判定と凍結順（stub repository 直駆動）", () => {
  test("units verify only through the model ledger AND backend checked[]; staleness by newest artifact mtime", () => {
    const repo: DoctorWorkspaceClient = {
      verificationScopes: () => [],
      functionalScopes: () => ["feature"],
      verificationTargets: () => [],
      designArtifacts: () => [],
      functionalTargets: () => [{
        space: "default",
        intent: "i1",
        units: [
          { name: "u1", newestArtifactMtime: 50 },
          { name: "u2", newestArtifactMtime: 150 },
          { name: "u3", newestArtifactMtime: 50 },
        ],
        modelMtime: 100,
        modelUnits: ["u1", "u2"],
        completedUnits: ["u1", "u2"],
        hasFindings: true,
        requirementsModelMtime: 200,
      }],
    };
    const out = new CheckFunctionalCoverageUseCase(repo).execute();
    const plainState = (r: UnitCoverageRow): string => r.matchState({ unverified: () => "unverified", stale: () => "stale" });
    expect(out.problems().map((r) => `${r.unitLabel()}:${plainState(r)}`)).toEqual(["default/i1/u2:stale", "default/i1/u3:unverified"]);
    expect(out.problems().map((r) => r.intent())).toEqual(["i1", "i1"]);
    expect(CoverageState.stale().equals(CoverageState.stale())).toBe(true);
    expect(CoverageState.stale().equals(CoverageState.unverified())).toBe(false);
    expect(out.refinementStale().map((r) => `${r.intentLabel()}:${r.intent()}`)).toEqual(["default/i1:i1"]);
    expect(out.eligibleCount()).toBe(3);
  });
});
