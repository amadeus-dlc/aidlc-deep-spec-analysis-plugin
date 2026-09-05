// DesignRecord 集約の永続化・再構成ポート（Repository は集約の I/O 責務。
// メソッドは永続化語彙のみ——オーナー裁定）。findById は集約 ID（発火対象の
// 成果物パスが恒等）から、record ルートの発見・関連成果物の読取・解析
// （形式知識）を Impl が行い、型付き集約を返す。対象が読めないときは
// not-found（呼び手が not-applicable を選ぶ期待分岐）。store は錨成果物の
// 原文（sourceDocument）をバイト逐語で書く——findById∘store はバイト恒等
// （往復則）。兄弟成果物は読み取り視点であり、各自の書き込み面は各成果物の
// Repository が担う。

import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { DesignRecord, DesignRecordIdentifier } from "@deep-spec/refcheck-domain";

export interface DesignRecordRepository {
  findById(id: DesignRecordIdentifier): Result<DesignRecord, RepositoryError>;
  store(record: DesignRecord): Result<void, RepositoryError>;
}
