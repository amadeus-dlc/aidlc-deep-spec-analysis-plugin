// contract-summary.md の refcheck ユースケース。
// Repository と契約2 のスキーマ値を保持し、execute は成果物パス（識別）を受けて
// 内部で集約を解決し、集約の門 checkContracts で CD 検査済みの
// ReferenceCheckReport を受け取り、適合（conformedTo）→ 永続化を起動する。
// verdict は保存したのと同じ conformed から導く（stdout とファイルの矛盾を
// 構造的に防ぐ、オーナー裁定 2026-09-04：Repository は集約の I/O だけを持ち、
// 適合は usecase が保存前に一度だけ済ませる）。

import type { FindingsSchema } from "@deep-spec/kernel-domain";
import { matchResult } from "@deep-spec/kernel-infrastructure";
import type { CheckContractSummaryInput } from "./check-contract-summary-input.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";

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
    return matchResult(this.#designRecordRepository.findById(input.recordId), {
      err: (): CheckOutcome => ({ kind: "not-applicable" }),
      ok: (record): CheckOutcome =>
        matchResult(record.checkContracts(input.reportDirectory), {
          err: (): CheckOutcome => ({ kind: "not-applicable" }),
          ok: (report): CheckOutcome => {
            const conformed = report.conformedTo(this.#findingsSchema);
            if (input.mode === "report-only") return { kind: "verified", report: conformed };
            return matchResult(this.#referenceCheckReportRepository.store(conformed), {
              err: (error): CheckOutcome => ({ kind: "save-failed", error }),
              ok: (): CheckOutcome => ({ kind: "verified", report: conformed }),
            });
          },
        }),
    });
  }
}
