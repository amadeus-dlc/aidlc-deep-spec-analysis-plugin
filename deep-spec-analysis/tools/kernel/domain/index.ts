// kernel/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// 形式（JSON/YAML/markdown/スキーマ）の知識はここに置かない——直列化形式は
// アダプタ層の知識であり、ユビキタス言語ではない（オーナー裁定 2026-08-30）。

export { type Expression } from "./expression.ts";
export { Expressions } from "./expressions.ts";
export { ContentHash } from "./content-hash.ts";
export { IrVersion } from "./ir-version.ts";
export { IdOrder } from "./id-order.ts";
export { TargetId } from "./target-id.ts";
export { TargetIds } from "./target-ids.ts";
export { FrRefs } from "./fr-refs.ts";
export { BackendName } from "./backend-name.ts";
export { RequirementIds } from "./requirement-ids.ts";
export { Names } from "./names.ts";
export { ArtifactPath } from "./artifact-path.ts";
export { AttributeBound } from "./attribute-bound.ts";
export { ErrorMessages } from "./error-messages.ts";
export { TriggerName } from "./trigger-name.ts";
