// RequirementsSource 集約 — 形式化の根拠となった requirements.md。id 集合と
// バイト列のダイジェスト、そして原文バイト列（原文材料——store の往復則
// findById∘store がバイト恒等）を運ぶ。探索は Repository の解決詳細だが、
// 解決された所在（sourcePath）は store の書き先として集約が保持する。

import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import type { RequirementsSourceId } from "./requirements-source-id.ts";

export interface RequirementsSource {
  readonly id: RequirementsSourceId;
  readonly sourcePath: ArtifactPath;
  readonly knownIds: RequirementIds;
  readonly digest: string;
  readonly sourceDocument: Uint8Array;
}
