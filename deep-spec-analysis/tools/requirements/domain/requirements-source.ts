// RequirementsSource 集約 — 形式化の根拠となった requirements.md。id 集合と
// バイト列のダイジェストだけを運ぶ（探索とバイト読みはアダプタ）。恒等は
// 記録の要件ソース集約の識別子。人間著作物のため書き込み面は持たない
// （オーナー裁定待ちの台帳行として #46 に記録）。

import type { RequirementIds } from "../../kernel/domain/index.ts";
import type { RequirementsSourceId } from "./requirements-source-id.ts";

export interface RequirementsSource {
  readonly id: RequirementsSourceId;
  readonly knownIds: RequirementIds;
  readonly digest: string;
}
