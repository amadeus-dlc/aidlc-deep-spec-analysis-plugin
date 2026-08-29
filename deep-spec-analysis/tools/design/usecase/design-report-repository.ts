// DesignReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
//
// conformedOf は「この Repository は契約不適合の文書を決して書かない」という
// 実装不変条件のクエリ面（refcheck / requirements と同じ規律）。save は常に
// conformed な姿を書く。findAllByDirectory はクロスチェックの凍結取得規則を
// 持つ：cross-check.json を除く *.json をファイル名順で読み、読めないファイル
// は黙って除く（その状態は各書き手が自分の文書で報告する）。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { DesignReport, DesignReportId } from "../domain/index.ts";

export interface DesignReportRepository {
  findById(aggregateId: DesignReportId): Result<DesignReport, RepositoryError>;
  findAllByDirectory(directory: string): Result<readonly DesignReport[], RepositoryError>;
  conformedOf(report: DesignReport): DesignReport;
  save(report: DesignReport): Result<void, RepositoryError>;
}
