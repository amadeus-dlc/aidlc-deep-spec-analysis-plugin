// 設計形式モデル（契約3 IR）取得ポート。findByPath は成果物パス（識別）から
// DesignModel と irHash（生 IR の正準 JSON の sha256——アダプタが導出）を
// 解決する。不在は not-found、fence/JSON/構造の不成立は corrupt で返し、
// corrupt.cause には降格文書に逐語で載る凍結文言が材料として入る。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { DesignModel } from "../domain/index.ts";

export interface AcquiredDesignModel {
  readonly model: DesignModel;
  readonly irHash: string;
}

export interface DesignModelRepository {
  findByPath(modelPath: string): Result<AcquiredDesignModel, RepositoryError>;
}
