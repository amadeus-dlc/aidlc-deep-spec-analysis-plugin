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
  RefinementRequirements,
} from "./refinement-requirements.ts";
export {
  type AttributeMapping,
  type EventMapping,
  type RefinementMapSeed,
  type RefinementUnitMap,
  type UnmappedEntry,
  RefinementMap,
} from "./refinement-map.ts";
export { type AlphaContext, AlphaError, alphaEquality, alphaExpr } from "./alpha-substitution.ts";
export {
  type RefinementStatus,
  type UnitRefinementPlan,
  designEnumValues,
  planUnitRefinement,
} from "./refinement-plan.ts";
export { reqEffectAssignments } from "./effect-assignments.ts";
export { type DesignEvent, designEventCatalog } from "./design-event-catalog.ts";
export {
  type RefinementProbe,
  type RefinementQueryStatus,
  type RefinementQueryVerdict,
  type RefinementSolverFacts,
} from "./refinement-solver-verdict.ts";
export {
  type InterpretedRefinementVerdicts,
  interpretRefinementVerdicts,
} from "./refinement-verdict-interpretation.ts";
export { quintRefinementStatusSkips, smtRefinementStatusSkips } from "./refinement-status-skips.ts";
export { type RefinementQuintExtra, refinementQuintExtras } from "./quint-extras.ts";
export { RefinementMapId } from "./refinement-map-id.ts";
// RefinementRequirements の恒等 — 契約1 集約の識別子そのもの（プロファイルは
// 恒等を変えない）。所有は requirements/domain。design のアダプタは refinement
// の面からこれを構築する（層規律：design/adapter→requirements/domain は禁止辺、
// design/adapter→refinement/domain は許可辺）。
export { FormalModelId } from "../../requirements/domain/index.ts";
