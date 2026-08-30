// DesignRecord 集約の再構成ポート（読取専用 Repository — save を持たない）。
// findById は集約 ID（発火対象の成果物パスが恒等）から、record ルートの
// 発見・関連成果物の読取・解析（形式知識）を Impl が行い、型付き集約を返す。対象が読めないときは
// not-found（呼び手が not-applicable を選ぶ期待分岐）。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { DesignRecord, DesignRecordId } from "../domain/index.ts";

export interface DesignRecordRepository {
  findById(id: DesignRecordId): Result<DesignRecord, RepositoryError>;
}
