// design/adapter の公開 facade — 明示列挙のみ（export * 禁止）。

export { parseDesignModel } from "./design-model-parser.ts";
export { parseDesignEntities, renderDesignEntities } from "./design-entities-parser.ts";
export { DesignModelRepositoryImplementation } from "./design-model-repository-implementation.ts";
export { renderLoweredDocument } from "./lowered-document-serializer.ts";
export { SiblingBackendClientImplementation } from "./sibling-backend-client-implementation.ts";
export { type SiblingBackendClientConfiguration } from "./sibling-backend-client-configuration.ts";
export { parseSiblingVerdictDocument } from "./sibling-document-parser.ts";
export {
  parseSiblingDesignReportDocument,
  renderDesignReportBytes,
} from "./design-report-serializer.ts";
export { DesignVerifyDirectoryRepositoryImplementation } from "./design-verify-directory-repository-implementation.ts";
export { reachabilityVariant } from "./reachability-variant.ts";
export { type RefinementChildQuery } from "./refinement-child-query.ts";
export { type RefinementQueryPlan, assembleQuery, buildRefinementQueries, decodeDesignModel, designBase, refinementSmtContext, smtOfExpr } from "./refinement-query-plan.ts";
export { type RefinementSatisfiabilityModuloTheoriesContext } from "./refinement-satisfiability-modulo-theories-context.ts";
export { REFINEMENT_MAP_BASENAME, REQUIREMENTS_MODEL_RELPATH, RefinementMaterialsRepositoryImplementation } from "./refinement-materials-repository-implementation.ts";
export { RefinementSolverClientImplementation } from "./refinement-solver-client-implementation.ts";
export { type RefinementSolverClientConfiguration } from "./refinement-solver-client-configuration.ts";
export { DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation } from "./design-intermediate-representation-validation-materials-repository-implementation.ts";
export { type DesignIntermediateRepresentationValidationMaterialsConfiguration } from "./design-intermediate-representation-validation-materials-configuration.ts";
export { RefinementMapRepositoryImplementation } from "./refinement-map-repository-implementation.ts";
