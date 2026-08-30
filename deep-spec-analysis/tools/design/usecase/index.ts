// design/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export { type AcquiredDesignModel, type DesignModelRepository } from "./design-model-repository.ts";
export { type DesignReportRepository } from "./design-report-repository.ts";
export {
  type ReachabilityProbe,
  type SiblingBackendClient,
  type SiblingLoweredRun,
} from "./sibling-backend-client.ts";
export {
  type RefinementMapAcquisition,
  type RefinementContextRepository,
  type RefinementPhaseContext,
} from "./refinement-context-repository.ts";
export {
  type RefinementCheck,
  type RefinementSolverClient,
  type RefinementSolverResult,
} from "./refinement-solver-client.ts";
export { type VerifyDesignOutcome } from "./verify-design-outcome.ts";
export { type VerifyDesignInput, VerifyDesignSmtUseCase } from "./verify-design-smt-usecase.ts";
export { VerifyDesignQuintUseCase } from "./verify-design-quint-usecase.ts";
export {
  type DesignIrMaterialsAcquisition,
  type DesignIrValidationMaterials,
  type DesignIrValidationMaterialsRepository,
} from "./design-ir-validation-materials-repository.ts";
export { type ValidateDesignIrOutcome } from "./validate-design-ir-outcome.ts";
export { ValidateDesignIrUseCase } from "./validate-design-ir-usecase.ts";
