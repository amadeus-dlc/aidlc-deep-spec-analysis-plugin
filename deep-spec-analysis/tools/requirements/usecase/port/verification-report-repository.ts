// VerificationReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
//
// メソッドは永続化語彙のみ（オーナー裁定: find_by_id / store 系）。store は
// 「この Repository は契約不適合の文書を決して書かない」実装不変条件を内包し、
// 契約適合させた姿を書いてその適合済み集約を返す（呼び出し側の観測面——
// pass / counts——は書かれた姿から導く）。findAllByDirectory はクロスチェックの凍結取得規則を持つ：同一
// ディレクトリの cross-check.json 以外の *.json をファイル名順で読み、
// 読めないファイルは黙って除く（その状態は各書き手が自分の文書で報告する）。

import type { Result } from "../../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../../kernel/usecase/index.ts";
import type { ArtifactPath } from "../../../kernel/domain/index.ts";
import type { VerificationReport, VerificationReportId, VerificationReports } from "../../domain/index.ts";

export interface VerificationReportRepository {
  findById(aggregateId: VerificationReportId): Result<VerificationReport, RepositoryError>;
  findAllByDirectory(directory: ArtifactPath): Result<VerificationReports, RepositoryError>;
  store(report: VerificationReport): Result<VerificationReport, RepositoryError>;
}
