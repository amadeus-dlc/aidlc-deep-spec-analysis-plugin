// refinement/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// このコンテキストは adapter を持たない：refinement は design のユースケースが
// 消費するドメインサービス群で、I/O・SMT-LIB という形式は design の
// ports / adapters が担う（公認エッジ：design/usecase → refinement/domain・
// design/adapter → refinement/domain）。

export { RefinementRequirements } from "./refinement-requirements.ts";
export { RefinementAttribute } from "./refinement-attribute.ts";
export { RefinementAttributes } from "./refinement-attributes.ts";
export { RefinementObligation } from "./refinement-obligation.ts";
export { RefinementObligations } from "./refinement-obligations.ts";
export { RefinementScenario } from "./refinement-scenario.ts";
export { RefinementScenarios } from "./refinement-scenarios.ts";
export { ReqAttributeValues } from "./req-attribute-values.ts";
export { RefinementMap } from "./refinement-map.ts";
export { AttributeMapping } from "./attribute-mapping.ts";
export { AttributeMappings } from "./attribute-mappings.ts";
export { EventMapping } from "./event-mapping.ts";
export { EventMappings } from "./event-mappings.ts";
export { RefinementUnitMap } from "./refinement-unit-map.ts";
export { RefinementUnitMaps } from "./refinement-unit-maps.ts";
export { TransitionRef } from "./transition-ref.ts";
export { TransitionRefs } from "./transition-refs.ts";
export { UnmappedDeclarations } from "./unmapped-declarations.ts";
export { UnmappedTargetRef } from "./unmapped-target-ref.ts";
export { UnmappedTarget } from "./unmapped-target.ts";
export { RefinementMapDefect } from "./refinement-map-defect.ts";
export { UnitRefinementPlan } from "./unit-refinement-plan.ts";
export { RefinementStatus } from "./refinement-status.ts";
export { EffectAssignments } from "./effect-assignments.ts";
export { DesignEventCatalog } from "./design-event-catalog.ts";
export { DesignAssignments } from "./design-assignments.ts";
export { DesignEvent } from "./design-event.ts";
export { RefinementSolverPlan } from "./refinement-solver-plan.ts";
export { RefinementProbe } from "./refinement-probe.ts";
export { RefinementQueryVerdict } from "./refinement-query-verdict.ts";
export { RefinementQueryVerdicts } from "./refinement-query-verdicts.ts";
export { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";
export { RefinementQuintInvariant } from "./refinement-quint-invariant.ts";
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
export { RefinementMapAcquisition } from "./refinement-map-acquisition.ts";
