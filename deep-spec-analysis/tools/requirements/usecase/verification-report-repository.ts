// VerificationReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
//
// conformedOf は「この Repository は契約不適合の文書を決して書かない」という
// 実装不変条件のクエリ面（refcheck と同じ規律）。save は常に conformed な姿を
// 書く。findAllByDirectory はクロスチェックの凍結取得規則を持つ：同一
// ディレクトリの cross-check.json 以外の *.json をファイル名順で読み、
// 読めないファイルは黙って除く（その状態は各書き手が自分の文書で報告する）。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { VerificationReport, VerificationReportId, VerificationReports } from "../domain/index.ts";

export interface VerificationReportRepository {
  findById(aggregateId: VerificationReportId): Result<VerificationReport, RepositoryError>;
  findAllByDirectory(directory: ArtifactPath): Result<VerificationReports, RepositoryError>;
  conformedOf(report: VerificationReport): VerificationReport;
  save(report: VerificationReport): Result<void, RepositoryError>;
}
