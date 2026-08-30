// refcheck/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { CATALOG_VERSION } from "./catalog-version.ts";
export { type RefEntry } from "./ref-entry.ts";
export { type Finding } from "./finding.ts";
export { type Skipped } from "./skipped.ts";
export { type InputAnchor } from "./input-anchor.ts";
export { sortFindings, sortSkipped } from "./catalog-order.ts";
export { ReferenceCheckReport, type ReferenceCheckReportSeed } from "./reference-check-report.ts";
export { ReferenceCheckReportId } from "./reference-check-report-id.ts";
export { CheckFamilyLedger } from "./check-family-ledger.ts";
export {
  type Component,
  type ComponentRef,
  type ComponentEntity,
  type ComponentShapeError,
  type ComponentCatalogOutcome,
} from "./component-catalog.ts";
export { COMPONENT_FAMILIES, runComponentChecks } from "./component-checks.ts";
export {
  type UnitDecl,
  type DeclaredUnitsOutcome,
  type ContractRow,
  type ContractsTableOutcome,
  type SpecBlockAssessment,
} from "./contract-summary.ts";
export { CONTRACT_FAMILIES, runContractChecks, type ContractChecksInput } from "./contract-checks.ts";
export {
  type AttrDecl,
  type RelDecl,
  type EntityDecl,
  type EntitiesModel,
  type EntitiesOutcome,
  type RuleDecl,
  type RulesOutcome,
  type StateMachineSketch,
  type FunctionalSpecOutcome,
  type DomainEntitySketch,
  type DomainEntitiesOutcome,
  type SiblingUnitEntities,
} from "./functional-design.ts";
export { FUNCTIONAL_FAMILIES, runFunctionalChecks, type FunctionalChecksInput } from "./functional-checks.ts";
export { DesignRecord, type DesignRecordSeed, type LoadedDocument } from "./design-record.ts";
export { DesignRecordId } from "./design-record-id.ts";
export { type CheckExecutionMode } from "./check-execution-mode.ts";
