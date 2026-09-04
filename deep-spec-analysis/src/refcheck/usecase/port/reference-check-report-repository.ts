// ReferenceCheckReport 集約の永続化・再構成ポート（Repository は集約の I/O 責務）。
// 保存先／読出元は集約識別子から実装が導出する。不在・I/O 失敗・破損は
// kernel 共有の RepositoryError（材料のみ）で返す。
//
// リポジトリの語彙は集約を保存・検索・取得・削除することだけ（オーナー裁定
// 2026-09-04）——この語彙に収まらない口は持たない。契約適合の可否は集約自身
// の `conformedTo`（ドメイン）が答えを持ち、usecase が保存前に一度だけ適合
// させてから store へ渡す。「store が書くはずの姿を書かずに問う」永続化契約
// の別口はこの語彙を外れるため持たない——verdict は usecase が保存したのと
// 同じ `conformedTo` の戻り値から導くことで、stdout とファイルの矛盾を
// 構造的に防ぐ（責務は移っただけで、不変条件そのものは変わらない）。

import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "@deep-spec/refcheck-domain";

export interface ReferenceCheckReportRepository {
  findById(aggregateId: ReferenceCheckReportId): Result<ReferenceCheckReport, RepositoryError>;
  store(report: ReferenceCheckReport): Result<void, RepositoryError>;
}
