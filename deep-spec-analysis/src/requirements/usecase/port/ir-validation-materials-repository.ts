// IrValidationMaterials 集約の永続化・再構成ポート（Repository は集約の I/O
// 責務。メソッドは永続化語彙のみ——オーナー裁定: find_by_id / store 系）。
// findById はフェンス抽出・JSON 解釈・スキーマ検証・逆トレーサビリティ材料の
// 抽出をアダプタに委ねて集約を返す。読めたが材料が組めない失敗は corrupt で
// 返し、corrupt.cause には verdict にそのまま載る凍結文言が材料として入る。
// 機能形式モデル以外・不在は not-found（use case が pass-through へ写像）。
// store は集約の原文（sourceDocument）をバイト逐語で書く——findById∘store は
// バイト恒等（往復則）。

import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type {
  IrValidationMaterials,
  IrValidationMaterialsId,
} from "@deep-spec/requirements-domain";

export interface IrValidationMaterialsRepository {
  findById(id: IrValidationMaterialsId): Result<IrValidationMaterials, RepositoryError>;
  store(materials: IrValidationMaterials): Result<void, RepositoryError>;
}

