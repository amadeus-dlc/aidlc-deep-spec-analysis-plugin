// design/adapter の公開 facade — 明示列挙のみ（export * 禁止）。

export { parseDesignModel } from "./design-model-parser.ts";
export { parseDesignEntities, renderDesignEntities } from "./design-entities-parser.ts";
export { DesignModelRepositoryImpl } from "./design-model-repository-impl.ts";
export { renderLoweredDocument } from "./lowered-document-serializer.ts";
export { SiblingBackendClientImpl } from "./sibling-backend-client-impl.ts";
export { type SiblingBackendClientConfig } from "./sibling-backend-client-config.ts";
export { parseSiblingVerdictDocument } from "./sibling-document-parser.ts";
export {
  parseSiblingDesignReportDocument,
  renderDesignReportBytes,
} from "./design-report-serializer.ts";
export { DesignVerifyDirectoryRepositoryImpl } from "./design-verify-directory-repository-impl.ts";
export { probeReached, reachabilityVariant } from "./reachability-variant.ts";
export { type RefinementChildQuery } from "./refinement-child-query.ts";
export { type RefinementQueryPlan, assembleQuery, buildRefinementQueries, decodeDesignModel, designBase, refinementSmtContext, smtOfExpr } from "./refinement-query-plan.ts";
export { type RefinementSmtContext } from "./refinement-smt-context.ts";
export { REFINEMENT_MAP_BASENAME, REQUIREMENTS_MODEL_RELPATH, RefinementMaterialsRepositoryImpl } from "./refinement-materials-repository-impl.ts";
export { RefinementSolverClientImpl } from "./refinement-solver-client-impl.ts";
export { type RefinementSolverClientConfig } from "./refinement-solver-client-config.ts";
export { DesignIrValidationMaterialsRepositoryImpl } from "./design-ir-validation-materials-repository-impl.ts";
export { type DesignIrValidationMaterialsConfig } from "./design-ir-validation-materials-config.ts";
export { RefinementMapRepositoryImpl } from "./refinement-map-repository-impl.ts";
