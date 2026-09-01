import type { DesignArtifactRef } from "./design-artifact-ref.ts";
import type { FunctionalTarget } from "./functional-target.ts";
import type { VerificationTarget } from "./verification-target.ts";

// aidlc ワークスペース（spaces/intents レコード）走査のポート。実装は adapter
// のゲートウェイ責務——stage frontmatter の scopes 読取、レコード歩行、
// digest/mtime の材料読取。走査順（readdir の自然順・unit の昇順）は凍結。
export interface DoctorWorkspaceRepository {
  verificationScopes(): readonly string[];
  functionalScopes(): readonly string[];
  verificationTargets(scopes: readonly string[]): readonly VerificationTarget[];
  designArtifacts(): readonly DesignArtifactRef[];
  functionalTargets(scopes: readonly string[]): readonly FunctionalTarget[];
}
