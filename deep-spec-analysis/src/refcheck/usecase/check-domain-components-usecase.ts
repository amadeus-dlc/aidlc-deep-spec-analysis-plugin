// components.md の refcheck ユースケース。
// Repository と契約2 のスキーマ値を保持し、execute は成果物パス（識別）を受けて
// 内部で集約（DesignRecord）を解決し、集約の門 checkComponents で DD 検査済み
// の ReferenceCheckReport を受け取り、適合（conformedTo）→ 永続化までを起動
// する。verdict は保存したのと同じ conformed（＝書かれる姿）から導出。

import type { FindingsSchema } from "@deep-spec/kernel-domain";
import { matchResult } from "@deep-spec/kernel-infrastructure";
import type { CheckDomainComponentsInput } from "./check-domain-components-input.ts";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";

export class CheckDomainComponentsUseCase {
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

  execute(input: CheckDomainComponentsInput): CheckOutcome {
    return matchResult(this.#designRecordRepository.findById(input.recordId), {
      err: (): CheckOutcome => ({ kind: "not-applicable" }),
      ok: (record): CheckOutcome =>
        matchResult(record.checkComponents(input.reportDirectory), {
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
