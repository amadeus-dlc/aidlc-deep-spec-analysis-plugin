import type {
  CoverageAssessment,
  InstalledStatuses,
  SolverAvailability,
  StructuralDebt,
  UnitCoverage,
  VersionAdvisory,
} from "@deep-spec-analysis/doctor-domain";
import { Check, CheckSeverity } from "@deep-spec-analysis/doctor-domain";
import type { Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

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

  installation(result: Result<InstalledStatuses, RepositoryError>): Check[] {
    if (!result.ok) return [this.#acquisitionFailure("installation manifest", result.error, CheckSeverity.error())];
    return result.value.toArray().map((s) =>
      Check.of({
        pass: s.isPresent(),
        label: `deep-spec-analysis: ${s.entry().rel()} installed`,
        fix: `Run \`bun ${this.#harnessDir}/tools/aidlc-utility.ts plugin-sync\` (or re-run the plugin's \`hooks/compose.ts\`).`,
        severity: s.entry().severity(),
      }),
    );
  }

  version(advisory: VersionAdvisory): Check {
    return advisory.match({
      current: (installed, latest) =>
        Check.of({
          pass: true,
          label: `deep-spec-analysis: version ${installed.version().asString()} from ${installed.source().asString()} ${installed.reference().asString()} is current (latest stable tag: ${latest.asTag()})`,
          severity: CheckSeverity.advisory(),
        }),
      updateAvailable: (installed, latest) =>
        Check.of({
          pass: false,
          label: `deep-spec-analysis: update available — version ${installed.version().asString()} from ${installed.source().asString()} ${installed.reference().asString()}; latest stable tag is ${latest.asTag()}`,
          fix: "Re-run the installer with `--project . --update` (and the same `--harness` selector used for this installation).",
          severity: CheckSeverity.advisory(),
        }),
      skipped: (installed, reason) =>
        Check.of({
          pass: true,
          label: `deep-spec-analysis: version update check skipped for ${installed.version().asString()} from ${installed.source().asString()} ${installed.reference().asString()} — ${reason.asString()}`,
          severity: CheckSeverity.advisory(),
        }),
      provenanceMissing: () =>
        Check.of({
          pass: false,
          label: "deep-spec-analysis: version update check unavailable — installation provenance is missing",
          fix: `Re-run the installer normally (without \`--update\`) to create ${this.#harnessDir}/tools/data/deep-spec-analysis-install.json.`,
          severity: CheckSeverity.advisory(),
        }),
      provenanceMalformed: (reason) =>
        Check.of({
          pass: false,
          label: `deep-spec-analysis: version update check unavailable — installation provenance is malformed (${reason.asString()})`,
          fix: `Re-run the installer normally (without \`--update\`) to replace ${this.#harnessDir}/tools/data/deep-spec-analysis-install.json.`,
          severity: CheckSeverity.advisory(),
        }),
    });
  }

  solvers(result: Result<SolverAvailability, RepositoryError>): Check[] {
    if (!result.ok) return [this.#acquisitionFailure("solver availability", result.error)];
    const availability = result.value;
    return [
      Check.of({
        pass: availability.hasZ3Package(),
        label: "deep-spec-analysis: z3-solver package present (SMT backend)",
        fix: "Run `bun add z3-solver` in the project root. Without it the SMT backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory(),
      }),
      Check.of({
        pass: availability.hasNodeRuntime(),
        label: "deep-spec-analysis: node runtime on PATH (executes the z3 child process)",
        fix: "Install Node.js >= 23 (its TypeScript type-stripping runs the solver child). Without it the SMT backend falls back to bun, which currently aborts on z3's pthread build.",
        severity: CheckSeverity.advisory(),
      }),
      Check.of({
        pass: availability.hasQuintCli(),
        label: "deep-spec-analysis: quint CLI on PATH (Quint backend)",
        fix: "Run `npm i -g @informalsystems/quint`. Without it the Quint backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory(),
      }),
      Check.of({
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

  verificationCoverage(result: Result<CoverageAssessment, RepositoryError>): Check[] {
    if (!result.ok) return [this.#acquisitionFailure("verification coverage", result.error)];
    const assessment = result.value;
    const rows: Check[] = assessment.problems().map((row) => {
      const noun = row.problemState()?.match({
        unverified: () => "has requirements with no deep-spec verification",
        stale: () => "changed its requirements after the last deep-spec verification",
      });
      return Check.of({
        pass: false,
        label: `deep-spec-analysis: intent ${row.location().space().asString()}/${row.location().intent().asString()} ${noun}`,
        fix:
          `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.location().intent().asString()}\`), ` +
          "then run `/aidlc --stage deep-spec-analysis-verify --single` to verify its requirements without advancing the workflow.",
        severity: CheckSeverity.advisory(),
      });
    });
    rows.push(
      Check.of({
        pass: assessment.isClean(),
        label:
          `deep-spec-analysis: verification coverage — ${assessment.verifiedCount()}/${assessment.eligibleCount()} ` +
          "eligible intents verified (scopes: " +
          [...assessment.scopes()].map((scope) => scope.asString()).join(", ") +
          ")",
        fix: "See the per-intent rows above for the exact command each unverified intent needs.",
        severity: CheckSeverity.advisory(),
      }),
    );
    return rows;
  }

  structuralDebt(result: Result<StructuralDebt, RepositoryError>): Check[] {
    if (!result.ok) return [this.#acquisitionFailure("design refcheck", result.error)];
    const debt = result.value;
    const rows: Check[] = debt.rows().map((row) =>
      Check.of({
        pass: false,
        label: `deep-spec-analysis: ${row.artifact().location().space().asString()}/${row.artifact().location().intent().asString()} ${row.artifact().relativePath().asString()} ${row.match(
          {
            complete: (findings) => `has ${findings.asNumber()} reference-integrity finding(s)`,
            partial: (findings, reason) =>
              `has ${findings.asNumber()} reference-integrity finding(s); inspection incomplete (${reason.asString()})`,
            unavailable: (reason) => `could not be inspected (${reason.asString()})`,
          },
        )}`,
        fix: row.match({
          complete: () =>
            "Open the artifact and fix (or record as an accepted risk) each finding; " +
            "the deep-spec-refcheck sensors re-check on every write and write the detail next to the artifact under deep-spec-refcheck/.",
          partial: () =>
            "Run the deep-spec-refcheck sensor in write mode and inspect deep-spec-refcheck/*.json for skipped inputs; restore the required inputs, run the sensor again, then fix or record each finding.",
          unavailable: (reason) =>
            `Resolve the deep-spec-refcheck backend error (${reason.asString()}), run the sensor in write mode, then run the doctor again.`,
        }),
        severity: CheckSeverity.advisory(),
      }),
    );
    if (debt.hasScans()) {
      rows.push(
        Check.of({
          pass: debt.isComplete() && debt.totalFindings() === 0,
          label: `deep-spec-analysis: design refcheck — ${debt.totalFindings()} structural finding(s) across ${debt.scannedCount()} design artifact(s) scanned (report-only)`,
          fix: "See the per-artifact rows above.",
          severity: CheckSeverity.advisory(),
        }),
      );
    }
    return rows;
  }

  functionalCoverage(result: Result<UnitCoverage, RepositoryError>): Check[] {
    // 凍結順: refinement 失効行（走査順）→ unit 問題行 → 要約行。
    if (!result.ok) return [this.#acquisitionFailure("design verification coverage", result.error)];
    const coverage = result.value;
    const rows: Check[] = coverage.refinementStale().map((row) =>
      Check.of({
        pass: false,
        label: `deep-spec-analysis: intent ${row.space().asString()}/${row.intent().asString()} re-verified its requirements after the last design verification (refinement evidence is stale)`,
        fix:
          `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent().asString()}\`), ` +
          "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to re-check the design against the current requirements.",
        severity: CheckSeverity.advisory(),
      }),
    );
    for (const row of coverage.problems()) {
      const label = row.match({
        valid: (unit, state) => {
          const noun = state.match({
            unverified: () => "has functional-design artifacts with no deep-spec design verification",
            stale: () => "changed its functional-design artifacts after the last design verification",
          });
          return `deep-spec-analysis: unit ${row.location().space().asString()}/${row.location().intent().asString()}/${unit.asString()} ${noun}`;
        },
        invalid: (detail) =>
          `deep-spec-analysis: unit ${row.location().space().asString()}/${row.location().intent().asString()}/<invalid-unit-name> has an invalid functional-design unit name (${detail.asString()})`,
      });
      rows.push(
        Check.of({
          pass: false,
          label,
          fix:
            `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.location().intent().asString()}\`), ` +
            "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to verify its functional design without advancing the workflow.",
          severity: CheckSeverity.advisory(),
        }),
      );
    }
    if (coverage.hasEligible()) {
      rows.push(
        Check.of({
          pass: coverage.isClean(),
          label:
            `deep-spec-analysis: design verification coverage — ${coverage.verifiedCount()}/${coverage.eligibleCount()} ` +
            "eligible units verified (scopes: " +
            [...coverage.scopes()].map((scope) => scope.asString()).join(", ") +
            ")",
          fix: "See the per-unit rows above for the exact command each unverified unit needs.",
          severity: CheckSeverity.advisory(),
        }),
      );
    }
    return rows;
  }

  #acquisitionFailure(
    subject: string,
    error: RepositoryError,
    severity: CheckSeverity = CheckSeverity.advisory(),
  ): Check {
    return Check.of({
      pass: false,
      label: `deep-spec-analysis: ${subject} unavailable — ${error.path}: ${error.kind}${"cause" in error ? ` (${error.cause})` : ""}`,
      fix: "Restore the artifact or directory and its read permissions, then run the doctor again.",
      severity,
    });
  }
}
