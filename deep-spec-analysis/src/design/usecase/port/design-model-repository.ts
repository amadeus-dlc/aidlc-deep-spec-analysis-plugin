// 設計形式モデル（契約3 IR）の永続化・再構成ポート（Repository は集約の
// I/O 責務。メソッドは永続化語彙のみ——オーナー裁定）。findById は集約 ID
// （成果物パスが恒等）から DesignModel を解決する。irHash（生 IR の正準
// JSON の sha256——アダプタが導出）は集約自身が運ぶ。不在は not-found、
// fence/JSON/構造の不成立は corrupt で返し、corrupt.cause には降格文書に
// 逐語で載る凍結文言が材料として入る。store は集約の原文（sourceDocument）を
// バイト逐語で書く——findById∘store はバイト恒等（往復則）。

import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { DesignModel, DesignModelId } from "@deep-spec/design-domain";

export interface DesignModelRepository {
  findById(id: DesignModelId): Result<DesignModel, RepositoryError>;
  store(model: DesignModel): Result<void, RepositoryError>;
}
