// refcheck/domain の公開 facade — 明示列挙のみ（export * 禁止）。

export { CATALOG_VERSION } from "./catalog-version.ts";
export { type WitnessRef } from "./witness-ref.ts";
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
export { CONTRACT_FAMILIES, runContractChecks, type ContractCheckMaterials } from "./contract-checks.ts";
export {
  type AttrDeclSeed,
  type DeclaredEntitiesSeed,
  type DomainEntitiesOutcome,
  type DomainEntitySketchSeed,
  type EntitiesOutcome,
  type EntityDeclSeed,
  type FunctionalSpecOutcome,
  type RelDeclSeed,
  type RuleDeclSeed,
  type RulesOutcome,
  type ShapeError,
  type SiblingUnitEntities,
  type StateMachineSketchSeed,
  AttrDecl,
  DeclaredEntities,
  DomainEntitySketch,
  EntityDecl,
  RelDecl,
  RuleDecl,
  StateMachineSketch,
} from "./functional-design.ts";
export { FUNCTIONAL_FAMILIES, runFunctionalChecks, type FunctionalCheckMaterials } from "./functional-checks.ts";
export { DesignRecord, type DesignRecordSeed, type LoadedDocument } from "./design-record.ts";
export { DesignRecordId } from "./design-record-id.ts";
export { type CheckExecutionMode } from "./check-execution-mode.ts";
export {
  type BoundError,
  type TokenError,
  AllowedValue,
  AppliesTo,
  AttributeDefault,
  AttributeName,
  BusinessRuleId,
  CardinalityNotation,
  ComponentName,
  ElementPath,
  EntityName,
  MachineSpec,
  NumericBound,
  ReferenceTarget,
  RuleCategory,
  SourceId,
  StateName,
  TypeName,
} from "./functional-design-values.ts";
