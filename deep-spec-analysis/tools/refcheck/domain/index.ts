// refcheck/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { CATALOG_VERSION } from "./catalog-version.ts";
export { type RefEntry } from "./ref-entry.ts";
export { type Finding } from "./finding.ts";
export { type Skipped } from "./skipped.ts";
export { type InputEntry } from "./input-entry.ts";
export { sortFindings, sortSkipped } from "./catalog-order.ts";
export { ReferenceCheckReport, type ReferenceCheckReportSeed, type FindingsSchemaUnreadable } from "./reference-check-report.ts";
export { ReferenceCheckReportId } from "./reference-check-report-id.ts";
