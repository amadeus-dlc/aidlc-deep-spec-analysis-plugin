import type { Result } from "../../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../../kernel/usecase/index.ts";
import type { RequirementsSource, RequirementsSourceId } from "../../domain/index.ts";

// 集約 ID による解決。記録ルート配下のどのフェーズに requirements.md が
// あるかの探索は Repository の解決詳細で、恒等には含まれない。
export interface RequirementsSourceRepository {
  findById(id: RequirementsSourceId): Result<RequirementsSource, RepositoryError>;
  store(source: RequirementsSource): Result<void, RepositoryError>;
}
