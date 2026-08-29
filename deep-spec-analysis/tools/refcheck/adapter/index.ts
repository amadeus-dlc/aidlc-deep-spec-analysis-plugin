// refcheck/adapter の公開 facade — 明示列挙のみ（export * 禁止）。

export { ReferenceCheckReportRepositoryImpl } from "./reference-check-report-repository-impl.ts";
export { conformToContract, renderReportBytes } from "./reference-check-report-serializer.ts";
