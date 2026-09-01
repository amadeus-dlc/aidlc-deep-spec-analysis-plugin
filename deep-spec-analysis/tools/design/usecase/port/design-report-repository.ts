// DesignReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
//
// store は「この Repository は契約不適合の文書を決して書かない」という
// 実装不変条件のクエリ面（refcheck / requirements と同じ規律）。save は常に
// conformed な姿を書く。findAllByDirectory はクロスチェックの凍結取得規則を
// 持つ：cross-check.json を除く *.json をファイル名順で読み、読めないファイル
// は黙って除く（その状態は各書き手が自分の文書で報告する）。

import type { Result } from "../../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../../kernel/usecase/index.ts";
import type { ArtifactPath } from "../../../kernel/domain/index.ts";
import type { DesignReport, DesignReportId, DesignReports } from "../../domain/index.ts";

export interface DesignReportRepository {
  findById(aggregateId: DesignReportId): Result<DesignReport, RepositoryError>;
  findAllByDirectory(directory: ArtifactPath): Result<DesignReports, RepositoryError>;
  // CQS（オーナー裁定 2026-09-01）：store は書くだけ——正常時は void。
  store(report: DesignReport): Result<void, RepositoryError>;
  // 「store が書くはずの姿」を書かずに問う照会——永続化契約の一部。verdict は
  // この戻り値から導く（stdout とファイルの矛盾を構造的に防ぐ）。
  conformedOf(report: DesignReport): DesignReport;
}
