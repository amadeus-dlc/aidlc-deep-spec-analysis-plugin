// Phase 3（refinement）の随伴成果物取得ポート。findById は文脈集約の ID
// （設計モデルへの 1:1 錨着が恒等）から、要件形式モデル・refinement map・
// inputs 台帳
// （3 成果物の相対パス＋sha256）を凍結取得規則で解決する：
//   - レコードルートが辿れない／要件モデルが読めない → inactive
//     （Phase 3 は丸ごと発火しない——旧 req === null 挙動）
//   - map 不在は {kind:"absent", error:null}、不成立は error に凍結文言
//     （fence 不正・JSON 不正・契約4 不適合・スキーマ不可読の 4 種）
//   - map 成立時のみ inputs（設計モデル・map・要件モデルの順）と
//     mapArtifact（witness refs に載る相対パス）を運ぶ
// 陳腐化（requirementsIrHash / designIrHash の不一致）の判定はユースケースの
// フロー制御——ポートは判定しない。

import type { DesignInputEntry, RefinementContextId } from "../domain/index.ts";
import type { RefinementMap, RefinementRequirements } from "../../refinement/domain/index.ts";

export type RefinementMapAcquisition =
  | { readonly kind: "absent"; readonly error: string | null }
  | {
      readonly kind: "loaded";
      readonly map: RefinementMap;
      readonly mapArtifact: string;
      readonly inputs: readonly DesignInputEntry[];
    };

export type RefinementPhaseContext =
  | { readonly kind: "inactive" }
  | {
      readonly kind: "active";
      readonly requirements: RefinementRequirements;
      readonly map: RefinementMapAcquisition;
    };

export interface RefinementContextRepository {
  findById(id: RefinementContextId): RefinementPhaseContext;
}
