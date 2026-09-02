// contract-summary.md の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約を解決し、
// 集約の門 checkContracts で CD 検査済みの ReferenceCheckReport を受け取り、
// 契約適合 → 永続化を起動する。

import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";
import type { CheckContractSummaryInput } from "./check-contract-summary-input.ts";


export class CheckContractSummaryUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
  }

  execute(input: CheckContractSummaryInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const checked = record.value.checkContracts(input.reportDirectory);
    if (!checked.ok) return { kind: "not-applicable" };
    const report = checked.value;
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
