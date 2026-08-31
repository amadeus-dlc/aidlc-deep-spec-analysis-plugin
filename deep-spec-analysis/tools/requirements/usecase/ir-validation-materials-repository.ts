// IrValidationMaterials 集約の永続化・再構成ポート（Repository は集約の I/O
// 責務。メソッドは永続化語彙のみ——オーナー裁定: find_by_id / store 系）。
// findById はフェンス抽出・JSON 解釈・スキーマ検証・逆トレーサビリティ材料の
// 抽出をアダプタに委ねて集約を返す。読めたが材料が組めない失敗は corrupt で
// 返し、corrupt.cause には verdict にそのまま載る凍結文言が材料として入る。
// 機能形式モデル以外・不在は not-found（use case が pass-through へ写像）。
// store は集約の原文（sourceDocument）をバイト逐語で書く——findById∘store は
// バイト恒等（往復則）。

import type { Result } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type {
  IrValidationMaterials,
  IrValidationMaterialsId,
  RequirementsSource,
  RequirementsSourceId,
} from "../domain/index.ts";

export interface IrValidationMaterialsRepository {
  findById(id: IrValidationMaterialsId): Result<IrValidationMaterials, RepositoryError>;
  store(materials: IrValidationMaterials): Result<IrValidationMaterials, RepositoryError>;
}

// 集約 ID による解決。記録ルート配下のどのフェーズに requirements.md が
// あるかの探索は Repository の解決詳細で、恒等には含まれない。
export interface RequirementsSourceRepository {
  findById(id: RequirementsSourceId): Result<RequirementsSource, RepositoryError>;
  store(source: RequirementsSource): Result<RequirementsSource, RepositoryError>;
}
