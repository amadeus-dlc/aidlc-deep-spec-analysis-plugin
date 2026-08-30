// 設計形式モデル（契約3 IR）取得ポート。findById は集約 ID（成果物パスが
// 恒等）から DesignModel と irHash（生 IR の正準 JSON の sha256——アダプタが
// 導出）を解決する。不在は not-found、fence/JSON/構造の不成立は corrupt で返し、
// corrupt.cause には降格文書に逐語で載る凍結文言が材料として入る。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { DesignModel, DesignModelId } from "../domain/index.ts";

export interface AcquiredDesignModel {
  readonly model: DesignModel;
  readonly irHash: string;
}

export interface DesignModelRepository {
  findById(id: DesignModelId): Result<AcquiredDesignModel, RepositoryError>;
}
