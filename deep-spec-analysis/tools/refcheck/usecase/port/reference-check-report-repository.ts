// ReferenceCheckReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
// 保存先／読出元は集約識別子から実装が導出する。不在・I/O 失敗・破損は
// kernel 共有の RepositoryError（材料のみ）で返す。
//
// CQS（オーナー裁定 2026-09-01）：store は書くだけ——正常時は void で、集約を
// 読み込んで返さない。「この Repository は契約不適合の文書を決して書かない」
// という実装不変条件のクエリ面は conformedOf——永続化される姿（不適合なら
// 凍結文言で降格した集約）を副作用なしで返し、呼び手はこれを verdict の
// 根拠にすることで stdout とファイルの矛盾を構造的に防ぐ。

import type { Result } from "../../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../../kernel/usecase/index.ts";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "../../domain/index.ts";

export interface ReferenceCheckReportRepository {
  findById(aggregateId: ReferenceCheckReportId): Result<ReferenceCheckReport, RepositoryError>;
  store(report: ReferenceCheckReport): Result<void, RepositoryError>;
  // 「store が書くはずの姿」を書かずに問う照会——永続化契約の一部（verdict は
  // モードによらずこの戻り値から導く。裁定改訂 2026-09-01：契約適合の別サービス
  // ポートは廃止し、書き込み前提の照会は Repository が運ぶ）。
  conformedOf(report: ReferenceCheckReport): ReferenceCheckReport;
}
