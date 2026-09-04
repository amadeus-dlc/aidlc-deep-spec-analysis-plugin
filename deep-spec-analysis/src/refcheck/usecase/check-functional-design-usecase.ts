// functional-design の refcheck ユースケース。
// Repository と契約2 のスキーマ値を保持し、execute は成果物パス（識別）を受けて
// 内部で集約を解決し、集約の門 checkFunctionalDesign で FD/XS 検査済みの
// ReferenceCheckReport を受け取り、適合（conformedTo）→ 永続化を起動する。
// inputs[] は集約が凍結取得規則で解決済みの文書から自分で記録する。

import type { FindingsSchema } from "@deep-spec/kernel-domain";
import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";
import type { CheckFunctionalDesignInput } from "./check-functional-design-input.ts";


export class CheckFunctionalDesignUseCase {
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

  execute(input: CheckFunctionalDesignInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const checked = record.value.checkFunctionalDesign(input.reportDirectory);
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
