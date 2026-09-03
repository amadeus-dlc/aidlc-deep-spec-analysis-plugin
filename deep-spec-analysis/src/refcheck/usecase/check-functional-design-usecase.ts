// functional-design の refcheck ユースケース。
// Repository を保持し、execute は成果物パス（識別）を受けて内部で集約を解決し、
// 集約の門 checkFunctionalDesign で FD/XS 検査済みの ReferenceCheckReport を
// 受け取り、契約適合 → 永続化を起動する。inputs[] は集約が凍結取得規則で
// 解決済みの文書から自分で記録する。

import type { CheckOutcome } from "./check-outcome.ts";
import type { DesignRecordRepository } from "./port/design-record-repository.ts";
import type { ReferenceCheckReportRepository } from "./port/reference-check-report-repository.ts";
import type { CheckFunctionalDesignInput } from "./check-functional-design-input.ts";


export class CheckFunctionalDesignUseCase {
  readonly #designRecordRepository: DesignRecordRepository;
  readonly #referenceCheckReportRepository: ReferenceCheckReportRepository;

  constructor(
    designRecordRepository: DesignRecordRepository,
    referenceCheckReportRepository: ReferenceCheckReportRepository,
  ) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
  }

  execute(input: CheckFunctionalDesignInput): CheckOutcome {
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok) return { kind: "not-applicable" };
    const checked = record.value.checkFunctionalDesign(input.reportDirectory);
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
