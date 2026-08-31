// refcheck/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export { type ReferenceCheckReportRepository } from "./reference-check-report-repository.ts";
export { type DesignRecordRepository } from "./design-record-repository.ts";
export { type CheckOutcome } from "./check-outcome.ts";
export { CheckDomainComponentsUseCase, type CheckDomainComponentsInput } from "./check-domain-components-usecase.ts";
export { CheckContractSummaryUseCase, type CheckContractSummaryInput } from "./check-contract-summary-usecase.ts";
export { CheckFunctionalDesignUseCase, type CheckFunctionalDesignInput } from "./check-functional-design-usecase.ts";
export { type ReferenceCheckReportConformance } from "./reference-check-report-conformance.ts";
