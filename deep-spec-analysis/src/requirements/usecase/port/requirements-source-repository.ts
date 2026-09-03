import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { RequirementsSource, RequirementsSourceId } from "@deep-spec/requirements-domain";

// 集約 ID による解決。記録ルート配下のどのフェーズに requirements.md が
// あるかの探索は Repository の解決詳細で、恒等には含まれない。
export interface RequirementsSourceRepository {
  findById(id: RequirementsSourceId): Result<RequirementsSource, RepositoryError>;
  store(source: RequirementsSource): Result<void, RepositoryError>;
}
