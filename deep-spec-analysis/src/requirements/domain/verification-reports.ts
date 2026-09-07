import {
  type BackendName,
  type ContentHash,
  type FirstClassCollection,
  FirstClassCollectionBase,
  KeyedIndex,
  ScenarioVerdicts,
  type TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import { boundedCollectionSnapshot, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import { CrossCheckedEntries } from "./cross-checked-entries.ts";
import { CrossCheckedEntry } from "./cross-checked-entry.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationReport } from "./verification-report.ts";
import type { VerificationReportIdentifier } from "./verification-report-identifier.ts";
import { VerificationSkips } from "./verification-skips.ts";

export class VerificationReports
  extends FirstClassCollectionBase<VerificationReport, VerificationReports>
  implements FirstClassCollection<VerificationReport>
{
  readonly #values: readonly VerificationReport[];

  private constructor(values: readonly VerificationReport[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-verification-reports");
  }

  protected override rebuild(values: readonly VerificationReport[]): VerificationReports {
    return new VerificationReports(values);
  }

  static parse(values: readonly VerificationReport[]): Result<VerificationReports, ParseError> {
    return parseConstruction(() => new VerificationReports(values));
  }

  static of(values: readonly VerificationReport[]): VerificationReports {
    return new VerificationReports(values);
  }

  add(value: VerificationReport): VerificationReports {
    return new VerificationReports([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<VerificationReport> {
    yield* this.#values;
  }

  toArray(): readonly VerificationReport[] {
    return this.#values;
  }
  // レポート自身が判定を決め、共通の比較規則からシナリオに診断を依頼する。
  crossChecked(id: VerificationReportIdentifier, model: RequirementsModel, irHash: ContentHash): VerificationReport {
    const findings: VerificationFinding[] = [];
    let compared = KeyedIndex.empty<BackendName, TargetIdentifier[]>();
    let failure: ParseError | null = null;
    for (const scenario of model.scenarios()) {
      const target = scenario.id().asTargetId();
      const verdicts = ScenarioVerdicts.parse(this.#values.map((report) => report.scenarioVerdictFor(target, irHash)));
      if (!verdicts.ok) {
        failure = verdicts.error;
        break;
      }
      for (const comparison of verdicts.value.comparisons()) {
        for (const backend of comparison.backends()) {
          const targets = compared.get(backend);
          if (targets === undefined) compared = compared.with(backend, [target]);
          else targets.push(target);
        }
        const finding = scenario.crossCheckFinding(comparison);
        if (finding !== null) findings.push(finding);
      }
    }
    const crossChecked = [...compared]
      .map(([backend, targets]) =>
        CrossCheckedEntry.of({
          backend,
          targets: TargetIdentifiers.of(targets).sortedUniqueCanonically(),
        }),
      )
      .sort((a, b) => a.compareByBackend(b));
    const report = VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: VerificationFindings.of(findings),
      skipped: VerificationSkips.of([]),
      crossChecked: CrossCheckedEntries.of(crossChecked),
    });
    return failure === null
      ? report
      : report.degraded(`scenario cross-check could not be constructed: ${failure.kind}`);
  }
}
