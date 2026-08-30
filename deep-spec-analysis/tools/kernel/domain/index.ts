// kernel/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// 形式（JSON/YAML/markdown/スキーマ）の知識はここに置かない——直列化形式は
// アダプタ層の知識であり、ユビキタス言語ではない（オーナー裁定 2026-08-30）。

export { type Expression, Expressions } from "./expression.ts";
export { type ContentHashError, ContentHash } from "./content-hash.ts";
export { type IrVersionError, IrVersion } from "./ir-version.ts";
export { IdOrder } from "./id-order.ts";
export { TargetIds } from "./target-id.ts";
export { FrRefs } from "./fr-refs.ts";
export { RequirementIds } from "./requirement-ids.ts";
export { Names } from "./name-normalize.ts";
export { type ArtifactPathError, ArtifactPath } from "./artifact-path.ts";
