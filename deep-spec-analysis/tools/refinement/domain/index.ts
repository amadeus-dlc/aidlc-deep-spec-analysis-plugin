// refinement/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// このコンテキストは adapter を持たない：refinement は design のユースケースが
// 消費するドメインサービス群で、I/O・SMT-LIB という形式は design の
// ports / adapters が担う（公認エッジ：design/usecase → refinement/domain・
// design/adapter → refinement/domain）。

export { RefinementRequirements } from "./refinement-requirements.ts";
export { type RefinementAttribute } from "./refinement-attribute.ts";
export { RefinementAttributes } from "./refinement-attributes.ts";
export { type RefinementObligation } from "./refinement-obligation.ts";
export { RefinementObligations } from "./refinement-obligations.ts";
export { type RefinementRequirementsSeed } from "./refinement-requirements-seed.ts";
export { type RefinementScenario } from "./refinement-scenario.ts";
export { RefinementScenarios } from "./refinement-scenarios.ts";
export { ReqAttributeValues } from "./req-attribute-values.ts";
export { RefinementMap } from "./refinement-map.ts";
export { type AttributeMapping } from "./attribute-mapping.ts";
export { AttributeMappings } from "./attribute-mappings.ts";
export { type EventMapping } from "./event-mapping.ts";
export { EventMappings } from "./event-mappings.ts";
export { type RefinementMapSeed } from "./refinement-map-seed.ts";
export { type RefinementUnitMap } from "./refinement-unit-map.ts";
export { RefinementUnitMaps } from "./refinement-unit-maps.ts";
export { TransitionRef } from "./transition-ref.ts";
export { TransitionRefs } from "./transition-refs.ts";
export { UnmappedDeclarations } from "./unmapped-declarations.ts";
export { UnmappedTargetRef } from "./unmapped-target-ref.ts";
export { type UnmappedTarget } from "./unmapped-target.ts";
export { AlphaContext } from "./alpha-context.ts";
export { AlphaError } from "./alpha-error.ts";
export { UnitRefinementPlan } from "./unit-refinement-plan.ts";
export { type RefinementStatus } from "./refinement-status.ts";
export { EffectAssignments } from "./effect-assignments.ts";
export { DesignEventCatalog } from "./design-event-catalog.ts";
export { DesignAssignments } from "./design-assignments.ts";
export { type DesignEvent } from "./design-event.ts";
export { RefinementSolverFacts } from "./refinement-solver-facts.ts";
export { type InterpretedRefinementVerdicts } from "./interpreted-refinement-verdicts.ts";
export { type RefinementProbe } from "./refinement-probe.ts";
export { type RefinementQueryStatus } from "./refinement-query-status.ts";
export { RefinementQueryVerdict } from "./refinement-query-verdict.ts";
export { RefinementQueryVerdicts } from "./refinement-query-verdicts.ts";
export { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";
export { type RefinementQuintInvariant } from "./refinement-quint-invariant.ts";
export { RefinementMapId } from "./refinement-map-id.ts";
// RefinementRequirements の恒等 — 契約1 集約の識別子そのもの（プロファイルは
// 恒等を変えない）。所有は requirements/domain。design のアダプタは refinement
// の面からこれを構築する（層規律：design/adapter→requirements/domain は禁止辺、
// design/adapter→refinement/domain は許可辺）。
export { FormalModelId } from "../../requirements/domain/index.ts";

// refinement の要件語彙は requirements の DP を再利用する——設計側アダプタは
// 裁可済みエッジ(design→refinement/domain)からこの facade 経由で受け取る。
export { AttributeBound, AttributePath, ObligationId, ObligationNature, ScenarioId } from "../../requirements/domain/index.ts";
export { RefinementMaterials } from "./refinement-materials.ts";
export { type RefinementMapAcquisition } from "./refinement-map-acquisition.ts";
