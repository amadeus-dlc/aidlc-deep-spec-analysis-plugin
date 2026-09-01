// RefinementMap 集約（契約4——人間が承認した抽象化関数 alpha の宣言）の
// 永続化・再構成ポート（Repository は集約の I/O 責務。メソッドは永続化語彙
// のみ——オーナー裁定）。findById は集約 ID（成果物パスが恒等）から文書を
// 読み、契約4 スキーマ検証込みで再構成する。不在は not-found、不成立は
// corrupt（cause は composite 取得面の absent(error) と同一の凍結文言）。
// store は集約の原文（sourceDocument）をバイト逐語で書く——findById∘store は
// バイト恒等（往復則）。
//
// Phase 3 の合成取得（RefinementMaterialsRepository）は読みの凍結規則を持つ
// ビューであり、map 文書の書き込み面はこのポートが担う。

import type { Result } from "../../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../../kernel/usecase/index.ts";
import type { RefinementMap, RefinementMapId } from "../../../refinement/domain/index.ts";

export interface RefinementMapRepository {
  findById(id: RefinementMapId): Result<RefinementMap, RepositoryError>;
  store(map: RefinementMap): Result<void, RepositoryError>;
}
