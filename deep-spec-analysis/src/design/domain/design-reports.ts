import {
  type BackendName,
  type ContentHash,
  KeyedIndex,
  ScenarioVerdicts,
  TargetIdentifier,
  TargetIdentifiers,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";
import type { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignModel } from "./design-model.ts";
import { DesignReport } from "./design-report.ts";
import type { DesignReportIdentifier } from "./design-report-identifier.ts";
import { DesignSkips } from "./design-skips.ts";

export class DesignReports {
  readonly #values: readonly DesignReport[];

  private constructor(values: readonly DesignReport[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignReport[]): DesignReports {
    return new DesignReports(values);
  }

  add(value: DesignReport): DesignReports {
    return new DesignReports([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignReport> {
    yield* this.#values;
  }

  toArray(): readonly DesignReport[] {
    return this.#values;
  }
  // レポート自身が判定を決め、共通の比較規則からシナリオに診断を依頼する。
  crossChecked(id: DesignReportIdentifier, model: DesignModel, irHash: ContentHash): DesignReport {
    const findings: DesignFinding[] = [];
    let compared = KeyedIndex.empty<BackendName, TargetIdentifier[]>();
    let failure: ParseError | null = null;
    scenarios: for (const unit of model.units())
      for (const scenario of unit.scenarios()) {
        const unitName = UnitName.of(unit.name());
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
    const crossChecked = [...compared]
      .map(([backend, targets]) =>
        DesignCrossCheckedEntry.of({
          backend,
          targets: TargetIdentifiers.of(targets).sortedUniqueCanonically(),
        }),
      )
      .sort((a, b) => a.compareByBackend(b));
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
