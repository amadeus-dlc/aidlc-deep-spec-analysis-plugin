import {
  type BackendName,
  type ContentHash,
  FirstClassCollectionBase,
  KeyedIndex,
  ScenarioVerdicts,
  TargetIdentifier,
  TargetIdentifiers,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import { boundedCollectionSnapshot, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";
import type { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignModel } from "./design-model.ts";
import { DesignReport } from "./design-report.ts";
import type { DesignReportIdentifier } from "./design-report-identifier.ts";
import { DesignSkips } from "./design-skips.ts";

export class DesignReports extends FirstClassCollectionBase<DesignReport, DesignReports> {
  readonly #values: readonly DesignReport[];

  private constructor(values: readonly DesignReport[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-reports");
  }

  protected override rebuild(values: readonly DesignReport[]): DesignReports {
    return new DesignReports(values);
  }

  static of(values: readonly DesignReport[]): DesignReports {
    return new DesignReports(values);
  }

  override map(transform: (element: DesignReport) => DesignReport): DesignReports {
    return this.mapTo(transform, DesignReports.of);
  }

  override combine(other: DesignReports): DesignReports {
    return this.combineTo(other, DesignReports.of);
  }

  static parse(values: readonly DesignReport[]): Result<DesignReports, ParseError> {
    return parseConstruction(() => new DesignReports(values));
  }

  override *[Symbol.iterator](): Iterator<DesignReport> {
    yield* this.#values;
  }

  toArray(): readonly DesignReport[] {
    return this.#values;
  }
  // レポート自身が判定を決め、共通の比較規則からシナリオに診断を依頼する。
  crossChecked(id: DesignReportIdentifier, model: DesignModel, irHash: ContentHash): DesignReport {
    const findings: DesignFinding[] = [];
    const crossChecked: DesignCrossCheckedEntry[] = [];
    let failure: ParseError | null = null;
    scenarios: for (const unit of model.units()) {
      const unitName = UnitName.of(unit.name());
      let compared = KeyedIndex.empty<BackendName, TargetIdentifier[]>();
      for (const scenario of unit.scenarios()) {
        const target = TargetIdentifier.of(scenario.id().asString());
        const verdicts = ScenarioVerdicts.parse(
          this.#values.map((report) => report.scenarioVerdictFor(unitName, target, irHash)),
        );
        if (!verdicts.ok) {
          failure = verdicts.error;
          break scenarios;
        }
        for (const comparison of verdicts.value.comparisons()) {
          for (const backend of comparison.backends()) {
            const targets = compared.get(backend);
            if (targets === undefined) compared = compared.with(backend, [target]);
            else targets.push(target);
          }
          const finding = scenario.crossCheckFinding(unitName, comparison);
          if (finding !== null) findings.push(finding);
        }
      }
      for (const [backend, targets] of compared) {
        crossChecked.push(
          DesignCrossCheckedEntry.of({
            backend,
            unit: unitName,
            targets: TargetIdentifiers.of(targets).sortedUniqueCanonically(),
          }),
        );
      }
    }
    crossChecked.sort((a, b) => a.compareTo(b));
    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of([]),
      crossChecked: DesignCrossCheckedEntries.of(crossChecked),
    });
    return failure === null
      ? report
      : report.degraded(`scenario cross-check could not be constructed: ${failure.kind}`);
  }
}
