// refinement/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// このコンテキストは adapter を持たない：refinement は design のユースケースが
// 消費するドメインサービス群で、I/O・SMT-LIB という形式は design の
// ports / adapters が担う（公認エッジ：design/usecase → refinement/domain・
// design/adapter → refinement/domain）。

export {
  type RefinementAttribute,
  type RefinementObligation,
  type RefinementRequirementsSeed,
  type RefinementScenario,
  RefinementAttributes,
  RefinementObligations,
  RefinementRequirements,
  RefinementScenarios,
  ReqAttributeValues,
} from "./refinement-requirements.ts";
export {
  type AttributeMapping,
  type EventMapping,
  type RefinementMapSeed,
  type RefinementUnitMap,
  type UnmappedTarget,
  AttributeMappings,
  EventMappings,
  RefinementMap,
  RefinementUnitMaps,
  TransitionRef,
  TransitionRefs,
  UnmappedDeclarations,
  UnmappedTargetRef,
  type RefinementMapTokenError,
} from "./refinement-map.ts";
export { AlphaContext, AlphaError } from "./alpha-substitution.ts";
export { type RefinementStatus, UnitRefinementPlan } from "./refinement-plan.ts";
export { EffectAssignments } from "./effect-assignments.ts";
export { type DesignEvent, DesignAssignments, DesignEventCatalog } from "./design-event-catalog.ts";
export {
  type InterpretedRefinementVerdicts,
  type RefinementProbe,
  type RefinementQueryStatus,
  type RefinementQueryVerdict,
  RefinementQueryVerdicts,
  RefinementSolverFacts,
} from "./refinement-solver-verdict.ts";
export { type RefinementQuintInvariant, RefinementQuintInvariants } from "./quint-invariants.ts";
export { RefinementMapId } from "./refinement-map-id.ts";
// RefinementRequirements の恒等 — 契約1 集約の識別子そのもの（プロファイルは
// 恒等を変えない）。所有は requirements/domain。design のアダプタは refinement
// の面からこれを構築する（層規律：design/adapter→requirements/domain は禁止辺、
// design/adapter→refinement/domain は許可辺）。
export { FormalModelId } from "../../requirements/domain/index.ts";

// refinement の要件語彙は requirements の DP を再利用する——設計側アダプタは
// 裁可済みエッジ(design→refinement/domain)からこの facade 経由で受け取る。
export { AttributeBound, AttributePath, ObligationId, ObligationNature, ScenarioId } from "../../requirements/domain/index.ts";
export {
  type RefinementMapAcquisition,
  RefinementMaterials,
} from "./refinement-materials.ts";
