// Phase 3（refinement）の随伴文脈集約の取得ポート（Repository は集約の I/O
// 責務。メソッドは永続化語彙のみ——オーナー裁定）。findById は文脈集約の ID
// （設計モデルへの 1:1 錨着が恒等）から、要件形式モデル・refinement map・
// inputs 台帳（3 成果物の相対パス＋sha256）を凍結取得規則で解決する：
//   - レコードルートが辿れない／要件モデルが存在しない → inactive 状態の集約
//     （Phase 3 は適用外）。存在する入力の不正・I/O 失敗は Result の失敗。
//   - map 不在は {kind:"absent", error:null}、不成立は error に凍結文言
//     （fence 不正・JSON 不正・契約4 不適合・スキーマ不可読の 4 種）
//   - map 成立時のみ inputs（設計モデル・map・要件モデルの順）と
//     mapArtifact（witness refs に載る相対パス）を運ぶ
// 陳腐化（requirementsIrHash / designIrHash の不一致）の判定はユースケースの
// フロー制御——ポートは判定しない。

import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { RefinementMaterialsIdentifier } from "@deep-spec/design-domain";
import type { RefinementMaterials } from "@deep-spec/design-domain";

export interface RefinementMaterialsRepository {
  findById(id: RefinementMaterialsIdentifier): Result<RefinementMaterials, RepositoryError>;
}
