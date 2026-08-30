// kernel/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// 形式（JSON/YAML/markdown/スキーマ）の知識はここに置かない——直列化形式は
// アダプタ層の知識であり、ユビキタス言語ではない（オーナー裁定 2026-08-30）。

export { type Expression, expressionUsesPrime, walkExpression } from "./expression.ts";
export { sha256 } from "./content-hash.ts";
export { idCompare, sortedUnique } from "./id-order.ts";
export { safeTarget } from "./target-id.ts";
export { requirementIds } from "./requirement-ids.ts";
export { normalizeName } from "./name-normalize.ts";
export { type ArtifactPathError, ArtifactPath } from "./artifact-path.ts";
