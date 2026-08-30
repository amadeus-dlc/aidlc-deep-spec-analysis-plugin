// design/adapter の公開 facade — 明示列挙のみ（export * 禁止）。

export { parseDesignModel } from "./design-model-parser.ts";
export { DesignModelRepositoryImpl } from "./design-model-repository-impl.ts";
export { renderLoweredDocument } from "./lowered-document-serializer.ts";
export { type SiblingBackendClientConfig, SiblingBackendClientImpl } from "./sibling-backend-client-impl.ts";
export { parseSiblingVerdictDocument } from "./sibling-document-parser.ts";
export {
  conformDesignReport,
  parseSiblingDesignReportDocument,
  renderDesignReportBytes,
} from "./design-report-serializer.ts";
export { DesignReportRepositoryImpl } from "./design-report-repository-impl.ts";
export { probeReached, reachabilityVariant } from "./reachability-variant.ts";
export {
  type RefinementChildQuery,
  type RefinementQueryPlan,
  type RefinementSmtContext,
  assembleQuery,
  buildRefinementQueries,
  decodeDesignModel,
  designBase,
  refinementSmtContext,
  smtOfExpr,
} from "./refinement-smt-compiler.ts";
export {
  REFINEMENT_MAP_BASENAME,
  REQUIREMENTS_MODEL_RELPATH,
  RefinementContextRepositoryImpl,
} from "./refinement-context-repository-impl.ts";
export { type RefinementSolverClientConfig, RefinementSolverClientImpl } from "./refinement-solver-client-impl.ts";
