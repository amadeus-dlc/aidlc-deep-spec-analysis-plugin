// ReferenceCheckReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
// 保存先／読出元は集約識別子から実装が導出する。不在・I/O 失敗・破損は
// kernel 共有の RepositoryError（材料のみ）で返す。

import type { Result } from "../../kernel/domain/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "../domain/index.ts";

export interface ReferenceCheckReportRepository {
  findById(aggregateId: ReferenceCheckReportId): Result<ReferenceCheckReport, RepositoryError>;
  save(report: ReferenceCheckReport): Result<void, RepositoryError>;
}
