// contract-summary.md の refcheck ユースケース。
// Repository と契約2 のスキーマ値を保持し、execute は成果物パス（識別）を受けて
// 内部で集約を解決し、集約の門 checkContracts で CD 検査済みの
// ReferenceCheckReport を受け取り、適合（conformedTo）→ 永続化を起動する。
// verdict は保存したのと同じ conformed から導く（stdout とファイルの矛盾を
// 構造的に防ぐ、オーナー裁定 2026-09-04：Repository は集約の I/O だけを持ち、
// 適合は usecase が保存前に一度だけ済ませる）。

import type { FindingsSchema } from "@deep-spec/kernel-domain";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";
import type { CheckContractSummaryInput } from "./check-contract-summary-input.ts";


export class CheckContractSummaryUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;
  readonly #findingsSchema: FindingsSchema;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
    findingsSchema: FindingsSchema,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
    this.#findingsSchema = findingsSchema;
  }

  execute(input: CheckContractSummaryInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const checked = record.value.checkContracts(input.reportDirectory);
    if (!checked.ok) return { kind: "not-applicable" };
    // 保存前に一度だけ適合させる——verdict はモードによらずこの conformed
    // から導く（凍結挙動）。
    const conformed = checked.value.conformedTo(this.#findingsSchema);
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(conformed);
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
