// design/usecase の公開 facade — 明示列挙のみ（export * 禁止）。

export { type AcquiredDesignModel, type DesignModelRepository } from "./design-model-repository.ts";
export { type DesignReportRepository } from "./design-report-repository.ts";
export {
  type ReachabilityProbe,
  type SiblingBackendClient,
  type SiblingLoweredRun,
} from "./sibling-backend-client.ts";
