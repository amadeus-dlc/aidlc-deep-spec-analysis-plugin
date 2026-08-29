// components.md の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約
// （DesignRecord）を解決し、DD 検査 → ReferenceCheckReport 組成 → 契約適合 →
// 永続化までを起動する。verdict は conformed（＝書かれる姿）から導出。

import {
  CheckFamilyLedger,
  COMPONENT_FAMILIES,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  runComponentChecks,
} from "../domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";

export interface CheckDomainComponentsInput {
  readonly artifactPath: string;
  readonly reportDirectory: string;
  readonly reportOnly: boolean;
}

export class CheckDomainComponentsUseCase {
  readonly #designRecords: DesignRecordRepository;
  readonly #reports: ReferenceCheckReportRepository;

  constructor(designRecords: DesignRecordRepository, reports: ReferenceCheckReportRepository) {
    this.#designRecords = designRecords;
    this.#reports = reports;
  }

  execute(input: CheckDomainComponentsInput): CheckOutcome {
    const record = this.#designRecords.findByArtifact(input.artifactPath);
    if (!record.ok) return { kind: "not-applicable" };
    const catalog = record.value.componentCatalog();
    if (catalog === null) return { kind: "not-applicable" };

    const ledger = new CheckFamilyLedger(COMPONENT_FAMILIES);
    runComponentChecks(catalog, record.value.target().artifact, ledger);
    const report = ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "components"),
      inputs: [record.value.target()],
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
    const conformed = this.#reports.conformedOf(report);
    if (!input.reportOnly) {
      const saved = this.#reports.save(conformed);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }
}
