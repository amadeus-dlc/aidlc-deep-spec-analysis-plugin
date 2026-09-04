// kernel/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// 直列化の手続き（JSON/YAML/markdown の読み書き）はここに置かない——形式を
// 走査する処理はアダプタ層の知識である（オーナー裁定 2026-08-30）。契約2 の
// スキーマそのもの（FindingsSchema）だけは例外で、適合判定はドメインの語彙
// ——「この文書は契約に適合するか」——なのでここに置く（計画 Step 21）。

export { type Expression } from "./expression.ts";
export { ExpressionTree } from "./expression-tree.ts";
export { ContentHash } from "./content-hash.ts";
export { IrVersion } from "./ir-version.ts";
export { TargetId } from "./target-id.ts";
export { TargetIds } from "./target-ids.ts";
export { FrRefs } from "./fr-refs.ts";
export { BackendName } from "./backend-name.ts";
export { RequirementIds } from "./requirement-ids.ts";
export { NormalizedName } from "./normalized-name.ts";
export { ArtifactPath } from "./artifact-path.ts";
export { AttributeBound } from "./attribute-bound.ts";
export { ErrorMessages } from "./error-messages.ts";
export { FindingsSchema } from "./findings-schema.ts";
export { TriggerName } from "./trigger-name.ts";
export { KeyedIndex } from "./keyed-index.ts";
export { KeySet } from "./key-set.ts";
export { RequirementId } from "./requirement-id.ts";
export { QueryLabel } from "./query-label.ts";
export { AttributePath } from "./attribute-path.ts";
export { UnitName } from "./unit-name.ts";
export { ObligationNature } from "./obligation-nature.ts";
export { FindingKind } from "./finding-kind.ts";
export { VerificationMethod } from "./verification-method.ts";
export { SkipReason } from "./skip-reason.ts";
export { AttributeKind } from "./attribute-kind.ts";
