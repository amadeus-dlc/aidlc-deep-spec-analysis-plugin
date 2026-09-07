import type { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import type { DirectoryFinalizationLockOutcome } from "./directory-finalization-lock-outcome.ts";

// 最終化処理が必要とするロック操作。所有トークンやファイル操作は実装が保持する。
export interface DirectoryFinalizationLockPort {
  canonicalPathOf(directory: ArtifactPath): string;
  acquire(directory: ArtifactPath): DirectoryFinalizationLockOutcome;
  holdsOwnership(directory: ArtifactPath): boolean;
  release(directory: ArtifactPath): DirectoryFinalizationLockOutcome;
}
