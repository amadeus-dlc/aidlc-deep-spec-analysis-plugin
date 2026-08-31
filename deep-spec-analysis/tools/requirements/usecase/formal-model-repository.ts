// 形式モデル（契約1 IR）の永続化・再構成ポート（Repository は集約の I/O
// 責務。メソッドは永続化語彙のみ——オーナー裁定）。findById は集約 ID
// （成果物パスが恒等）から RequirementsModel を解決する。irHash（生 IR の
// 正準 JSON の sha256——アダプタが導出）は集約自身が運ぶ。不在は not-found、
// fence/JSON/構造の不成立は corrupt で返し、corrupt.cause には降格文書に
// 逐語で載る凍結文言が材料として入る。形式モデルは人間・上流工程の著作物の
// ため書き込み面は持たない（#46 台帳の裁定待ち行）。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { FormalModelId, RequirementsModel } from "../domain/index.ts";

export interface FormalModelRepository {
  findById(id: FormalModelId): Result<RequirementsModel, RepositoryError>;
}
