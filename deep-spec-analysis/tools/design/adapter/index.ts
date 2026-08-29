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
