// components.md の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約
// （DesignRecord）を解決し、DD 検査 → ReferenceCheckReport 組成 → 契約適合 →
// 永続化までを起動する。verdict は conformed（＝書かれる姿）から導出。

import {
  type CheckExecutionMode,
  type DesignRecordId,
  CheckFamilyLedger,
  InputAnchors,
  COMPONENT_FAMILIES,
  ComponentCheckMaterials,
  ReferenceCheckReport,
  ReferenceCheckReportId,
} from "../domain/index.ts";
import { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./design-record-repository.ts";
import type { ReferenceCheckReportConformance } from "./reference-check-report-conformance.ts";
import type { ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";

export interface CheckDomainComponentsInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}

export class CheckDomainComponentsUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;
  readonly #referenceCheckReportConformance: ReferenceCheckReportConformance;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
    referenceCheckReportConformance: ReferenceCheckReportConformance,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
    this.#referenceCheckReportConformance = referenceCheckReportConformance;
  }

  execute(input: CheckDomainComponentsInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const catalog = record.value.componentCatalog();
    if (catalog === null) return { kind: "not-applicable" };

    const ledger = new CheckFamilyLedger(COMPONENT_FAMILIES);
    ComponentCheckMaterials.of({ outcome: catalog, artifact: ArtifactPath.reconstitute(record.value.target().artifact) }).runChecks(ledger);
    const report = ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "components"),
      inputs: InputAnchors.of([record.value.target()]),
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
    // persist は store（適合を内包し書かれた姿を返す）、report-only は適合だけを
    // 問う——どちらの verdict も「書かれる(はずの)姿」から導く（凍結挙動）。
    let conformed: ReferenceCheckReport;
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(report);
      if (!stored.ok) return { kind: "save-failed", error: stored.error };
      conformed = stored.value;
    } else {
      conformed = this.#referenceCheckReportConformance.conformedOf(report);
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }
}
