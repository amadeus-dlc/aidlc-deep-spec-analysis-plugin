// contract-summary.md の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約を解決し、
// CD 検査 → 組成 → 契約適合 → 永続化を起動する。

import {
  CheckFamilyLedger,
  InputAnchors,
  CONTRACT_FAMILIES,
  ContractCheckMaterials,
  ReferenceCheckReport,
  ReferenceCheckReportId,
} from "../domain/index.ts";
import { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./design-record-repository.ts";
import type { ReferenceCheckReportConformance } from "./reference-check-report-conformance.ts";
import type { ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";
import type { CheckContractSummaryInput } from "./check-contract-summary-input.ts";


export class CheckContractSummaryUseCase {
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

  execute(input: CheckContractSummaryInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const contractsTable = record.value.contractsTable();
    const specBlocks = record.value.specBlocks();
    const declaredUnits = record.value.declaredUnits();
    if (contractsTable === null || specBlocks === null || declaredUnits === null) return { kind: "not-applicable" };

    const ledger = CheckFamilyLedger.of(CONTRACT_FAMILIES);
    ContractCheckMaterials.of({
      artifact: ArtifactPath.reconstitute(record.value.target().artifact),
      depArtifact: declaredUnits.artifactName,
      declaredUnits: declaredUnits.document === null ? { kind: "absent" } : declaredUnits.document.outcome,
      contractsTable,
      specBlocks,
    }).runChecks(ledger);

    let inputs = InputAnchors.of([record.value.target()]);
    if (declaredUnits.document !== null) inputs = inputs.add(declaredUnits.document.input);
    const report = ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "contract-summary"),
      inputs,
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
