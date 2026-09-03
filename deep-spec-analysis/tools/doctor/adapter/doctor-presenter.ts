import { Check, CheckSeverity } from "../domain/index.ts";
import type { InstalledStatus, SolverAvailability } from "../domain/index.ts";
import type { CoverageAssessment, StructuralDebt, UnitCoverage } from "../usecase/index.ts";

// doctor 検査行の presenter——label/fix の凍結文言はすべてここに封じる
//（移行 PR9、#22）。installer（scripts/install.ts）が grep する部分文字列
//（"no deep-spec verification" / "after the last deep-spec verification" /
// "verification coverage"）と intent-e2e が表明する label は逐語凍結。
// Check リテラルのプロパティ順（pass, label, fix, severity）は直列化バイト。
export class DoctorPresenter {
  readonly #harnessDir: string;

  constructor(config: { harnessDir: string }) {
    this.#harnessDir = config.harnessDir;
  }

  installation(statuses: readonly InstalledStatus[]): Check[] {
    return statuses.map((s) => Check.reconstitute({
      pass: s.isPresent(),
      label: `deep-spec-analysis: ${s.entry().rel()} installed`,
      fix: `Run \`bun ${this.#harnessDir}/tools/aidlc-utility.ts plugin-sync\` (or re-run the plugin's \`hooks/compose.ts\`).`,
      severity: s.entry().severity(),
    }));
  }

  solvers(availability: SolverAvailability): Check[] {
    return [
      Check.reconstitute({
        pass: availability.hasZ3Package(),
        label: "deep-spec-analysis: z3-solver package present (SMT backend)",
        fix: "Run `bun add z3-solver` in the project root. Without it the SMT backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory(),
      }),
      Check.reconstitute({
        pass: availability.hasNodeRuntime(),
        label: "deep-spec-analysis: node runtime on PATH (executes the z3 child process)",
        fix: "Install Node.js >= 23 (its TypeScript type-stripping runs the solver child). Without it the SMT backend falls back to bun, which currently aborts on z3's pthread build.",
        severity: CheckSeverity.advisory(),
      }),
      Check.reconstitute({
        pass: availability.hasQuintCli(),
        label: "deep-spec-analysis: quint CLI on PATH (Quint backend)",
        fix: "Run `npm i -g @informalsystems/quint`. Without it the Quint backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory(),
      }),
      Check.reconstitute({
        pass: availability.hasApalache(),
        label: "deep-spec-analysis: Apalache available (quint verify, method: bounded)",
        // 陳腐化した待ち受けサーバは「入れ方」を教えても直らない——止め方を教える
        // （issue #128）。導入手順の文言は逐語凍結のまま残す。
        fix: availability.apalacheServerIsStale()
          ? "An Apalache server is listening on localhost:8822 but cannot verify — typically an orphan that still holds a deleted working directory. Stop it (`lsof -nP -iTCP:8822 -sTCP:LISTEN` shows the PID, then `kill <pid>`); quint starts a fresh server on the next `quint verify`."
          : "Install a JDK (17+) and run any `quint verify` once so quint downloads its Apalache distribution into ~/.quint (or set APALACHE_DIST). Without it the Quint backend uses seeded simulation (method: simulation) and skips leads-to temporal obligations.",
        severity: CheckSeverity.advisory(),
      }),
    ];
  }

  verificationCoverage(assessment: CoverageAssessment): Check[] {
    const rows: Check[] = assessment.problems().map((row) => {
      const noun = row.matchState({
        unverified: () => "has requirements with no deep-spec verification",
        stale: () => "changed its requirements after the last deep-spec verification",
      });
      return Check.reconstitute({
        pass: false,
        label: `deep-spec-analysis: intent ${row.intentLabel()} ${noun}`,
        fix:
          `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent()}\`), ` +
          "then run `/aidlc --stage deep-spec-analysis-verify --single` to verify its requirements without advancing the workflow.",
        severity: CheckSeverity.advisory(),
      });
    });
    rows.push(Check.reconstitute({
      pass: assessment.isClean(),
      label:
        `deep-spec-analysis: verification coverage — ${assessment.verifiedCount()}/${assessment.eligibleCount()} ` +
        "eligible intents verified (scopes: " + assessment.scopes().join(", ") + ")",
      fix: "See the per-intent rows above for the exact command each unverified intent needs.",
      severity: CheckSeverity.advisory(),
    }));
    return rows;
  }

  structuralDebt(debt: StructuralDebt): Check[] {
    const rows: Check[] = debt.rows().map((row) => Check.reconstitute({
      pass: false,
      label: `deep-spec-analysis: ${row.locationLabel()} has ${row.findingCount()} reference-integrity finding(s)`,
      fix:
        "Open the artifact and fix (or record as an accepted risk) each finding; " +
        "the deep-spec-refcheck sensors re-check on every write and write the detail next to the artifact under deep-spec-refcheck/.",
      severity: CheckSeverity.advisory(),
    }));
    if (debt.hasScans()) {
      rows.push(Check.reconstitute({
        pass: debt.totalFindings() === 0,
        label: `deep-spec-analysis: design refcheck — ${debt.totalFindings()} structural finding(s) across ${debt.scannedCount()} design artifact(s) scanned (report-only)`,
        fix: "See the per-artifact rows above.",
        severity: CheckSeverity.advisory(),
      }));
    }
    return rows;
  }

  functionalCoverage(coverage: UnitCoverage): Check[] {
    // 凍結順: refinement 失効行（走査順）→ unit 問題行 → 要約行。
    const rows: Check[] = coverage.refinementStale().map((row) => Check.reconstitute({
      pass: false,
      label: `deep-spec-analysis: intent ${row.intentLabel()} re-verified its requirements after the last design verification (refinement evidence is stale)`,
      fix:
        `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent()}\`), ` +
        "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to re-check the design against the current requirements.",
      severity: CheckSeverity.advisory(),
    }));
    for (const row of coverage.problems()) {
      const noun = row.matchState({
        unverified: () => "has functional-design artifacts with no deep-spec design verification",
        stale: () => "changed its functional-design artifacts after the last design verification",
      });
      rows.push(Check.reconstitute({
        pass: false,
        label: `deep-spec-analysis: unit ${row.unitLabel()} ${noun}`,
        fix:
          `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent()}\`), ` +
          "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to verify its functional design without advancing the workflow.",
        severity: CheckSeverity.advisory(),
      }));
    }
    if (coverage.hasEligible()) {
      rows.push(Check.reconstitute({
        pass: coverage.isClean(),
        label:
          `deep-spec-analysis: design verification coverage — ${coverage.verifiedCount()}/${coverage.eligibleCount()} ` +
          "eligible units verified (scopes: " + coverage.scopes().join(", ") + ")",
        fix: "See the per-unit rows above for the exact command each unverified unit needs.",
        severity: CheckSeverity.advisory(),
      }));
    }
    return rows;
  }
}
