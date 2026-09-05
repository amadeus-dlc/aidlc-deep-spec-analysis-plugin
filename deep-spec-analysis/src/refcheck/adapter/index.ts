// refcheck/adapter の公開 facade — 明示列挙のみ（export * 禁止）。

export { parseComponentCatalog } from "./component-catalog-parser.ts";
export { assessSpecBlocks, parseContractsTable, parseDeclaredUnits } from "./contract-summary-parser.ts";
export { DesignRecordRepositoryImplementation } from "./design-record-repository-implementation.ts";
export {
  buildSiblingUnitEntities,
  parseDomainEntitiesDocument,
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
  parseRulesDocument,
} from "./functional-design-parser.ts";
export { ReferenceCheckReportRepositoryImplementation } from "./reference-check-report-repository-implementation.ts";
export { renderReportBytes } from "./reference-check-report-serializer.ts";
