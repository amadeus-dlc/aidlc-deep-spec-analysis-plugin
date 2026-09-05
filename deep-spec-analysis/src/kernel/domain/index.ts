// kernel/domain の公開 facade — 明示列挙のみ（export * 禁止）。
// 直列化の手続き（JSON/YAML/markdown の読み書き）はここに置かない——形式を
// 走査する処理はアダプタ層の知識である（オーナー裁定 2026-08-30）。契約2 の
// スキーマそのもの（FindingsSchema）だけは例外で、適合判定はドメインの語彙
// ——「この文書は契約に適合するか」——なのでここに置く（計画 Step 21）。

export { ArtifactPath } from "./artifact-path.ts";
export { AttributeBound } from "./attribute-bound.ts";
export { AttributeKind } from "./attribute-kind.ts";
export { AttributePath } from "./attribute-path.ts";
export { BackendName } from "./backend-name.ts";
export { BindingDeclaration } from "./binding-declaration.ts";
export { BindingValue } from "./binding-value.ts";
export { ContentHash } from "./content-hash.ts";
export { Declaration } from "./declaration.ts";
export { DeclaredBindingValue } from "./declared-binding-value.ts";
export { DeclaredBindings } from "./declared-bindings.ts";
export { DeclaredBound } from "./declared-bound.ts";
export { DeclaredDigest } from "./declared-digest.ts";
export { EnumerationMember } from "./enumeration-member.ts";
export { EnumerationMembers } from "./enumeration-members.ts";
export { ErrorMessage } from "./error-message.ts";
export { ErrorMessages } from "./error-messages.ts";
export type { Expression } from "./expression.ts";
export { ExpressionTree } from "./expression-tree.ts";
export { FindingKind } from "./finding-kind.ts";
export { FindingsSchema } from "./findings-schema.ts";
export { FunctionalRequirementReferences } from "./functional-requirement-references.ts";
export { IntermediateRepresentationVersion } from "./intermediate-representation-version.ts";
export { KeySet } from "./key-set.ts";
export { KeyedIndex } from "./keyed-index.ts";
export { NormalizedName } from "./normalized-name.ts";
export { ObligationNature } from "./obligation-nature.ts";
export { QueryLabel } from "./query-label.ts";
export { RequirementIdentifier } from "./requirement-identifier.ts";
export { RequirementIdentifiers } from "./requirement-identifiers.ts";
export { ScenarioBinding } from "./scenario-binding.ts";
export { ScenarioBindings } from "./scenario-bindings.ts";
export { SkipReason } from "./skip-reason.ts";
export { TargetIdentifier } from "./target-identifier.ts";
export { TargetIdentifiers } from "./target-identifiers.ts";
export { TriggerName } from "./trigger-name.ts";
export { UnitName } from "./unit-name.ts";
export { ValidationAssessment } from "./validation-assessment.ts";
export { VerificationMethod } from "./verification-method.ts";
