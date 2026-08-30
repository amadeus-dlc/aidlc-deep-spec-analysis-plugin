// components.md の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約
// （DesignRecord）を解決し、DD 検査 → ReferenceCheckReport 組成 → 契約適合 →
// 永続化までを起動する。verdict は conformed（＝書かれる姿）から導出。

import {
  type CheckExecutionMode,
  type DesignRecordId,
  CheckFamilyLedger,
  COMPONENT_FAMILIES,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  runComponentChecks,
} from "../domain/index.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";

export interface CheckDomainComponentsInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}

export class CheckDomainComponentsUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;

  constructor(designRecordRepository: DesignRecordRepository, referenceCheckReportRepository: ReferenceCheckReportRepository) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
  }

  execute(input: CheckDomainComponentsInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
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
    const conformed = this.#referenceCheckReportRepository.conformedOf(report);
    if (input.mode === "persist") {
      const saved = this.#referenceCheckReportRepository.save(conformed);
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
