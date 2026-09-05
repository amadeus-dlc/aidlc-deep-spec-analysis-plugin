// design/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export type { DesignAcquisitionResult } from "./design-acquisition-result.ts";
export type { DesignAcquisitionTerminal } from "./design-acquisition-terminal.ts";
export { DesignReportFinalizer } from "./design-report-finalizer.ts";
export { DesignVerificationAcquirer } from "./design-verification-acquirer.ts";
export type { DesignIntermediateRepresentationValidationMaterialsRepository } from "./port/design-intermediate-representation-validation-materials-repository.ts";
export type { DesignModelRepository } from "./port/design-model-repository.ts";
export type { DesignVerifyDirectoryRepository } from "./port/design-verify-directory-repository.ts";
export type { RefinementCheck } from "./port/refinement-check.ts";
export type { RefinementMapRepository } from "./port/refinement-map-repository.ts";
export type { RefinementMaterialsRepository } from "./port/refinement-materials-repository.ts";
export type { RefinementSolverClient } from "./port/refinement-solver-client.ts";
export type { RefinementSolverResult } from "./port/refinement-solver-result.ts";
export type { SiblingBackendClient } from "./port/sibling-backend-client.ts";
export type { SiblingLoweredRun } from "./port/sibling-lowered-run.ts";
export type { ValidateDesignIntermediateRepresentationOutcome } from "./validate-design-intermediate-representation-outcome.ts";
export { ValidateDesignIntermediateRepresentationUseCase } from "./validate-design-intermediate-representation-usecase.ts";
export type { VerifyDesignInput } from "./verify-design-input.ts";
export type { VerifyDesignOutcome } from "./verify-design-outcome.ts";
export { VerifyDesignQuintUseCase } from "./verify-design-quint-usecase.ts";
export { VerifyDesignSatisfiabilityModuloTheoriesUseCase } from "./verify-design-satisfiability-modulo-theories-usecase.ts";
