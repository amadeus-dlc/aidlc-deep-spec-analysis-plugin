// ReferenceCheckReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
// 保存先／読出元は集約識別子から実装が導出する。不在・I/O 失敗・破損は
// kernel 共有の RepositoryError（材料のみ）で返す。
//
// store は「この Repository は契約不適合の文書を決して書かない」という
// 実装不変条件のクエリ面：永続化される姿（不適合なら凍結文言で降格した集約）を
// 副作用なしで返す。呼び手はこれを verdict の根拠にすることで、stdout と
// ファイルの矛盾を構造的に防ぐ。save は常に conformed な姿を書く。

import type { Result } from "../../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../../kernel/usecase/index.ts";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "../../domain/index.ts";

export interface ReferenceCheckReportRepository {
  findById(aggregateId: ReferenceCheckReportId): Result<ReferenceCheckReport, RepositoryError>;
  store(report: ReferenceCheckReport): Result<ReferenceCheckReport, RepositoryError>;
  // 「store が書くはずの姿」を書かずに問う照会——永続化契約の一部（report-only
  // の verdict はこの戻り値から導く。裁定改訂 2026-09-01：契約適合の別サービス
  // ポートは廃止し、書き込み前提の照会は Repository が運ぶ）。
  conformedOf(report: ReferenceCheckReport): ReferenceCheckReport;
}
