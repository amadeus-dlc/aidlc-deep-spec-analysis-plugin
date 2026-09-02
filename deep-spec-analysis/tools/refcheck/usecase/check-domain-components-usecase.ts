// components.md の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約
// （DesignRecord）を解決し、DD 検査 → ReferenceCheckReport 組成 → 契約適合 →
// 永続化までを起動する。verdict は conformed（＝書かれる姿）から導出。

import {
  CheckFamilyLedger,
  InputAnchors,
  COMPONENT_FAMILIES,
  ComponentCheckMaterials,
  ReferenceCheckReport,
  ReferenceCheckReportId,
} from "../domain/index.ts";
import { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";
import type { CheckDomainComponentsInput } from "./check-domain-components-input.ts";


export class CheckDomainComponentsUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
  }

  execute(input: CheckDomainComponentsInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const catalog = record.value.componentCatalog();
    if (catalog === null) return { kind: "not-applicable" };

    const ledger = CheckFamilyLedger.of(COMPONENT_FAMILIES);
    ComponentCheckMaterials.of({ outcome: catalog, artifact: ArtifactPath.reconstitute(record.value.target().artifact()) }).runChecks(ledger);
    const report = ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "components"),
      inputs: InputAnchors.of([record.value.target()]),
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
    // CQS: verdict はモードによらず conformedOf（照会）から導く——store は
    // 書くだけ（void）で、内部で同じ適合を通すため stdout とファイルは
    // 構造的に一致する（凍結挙動）。
    const conformed = this.#referenceCheckReportRepository.conformedOf(report);
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(report);
      if (!stored.ok) return { kind: "save-failed", error: stored.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }
}
