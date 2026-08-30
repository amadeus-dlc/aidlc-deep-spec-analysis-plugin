// 契約3 設計 IR の検査材料の取得ポート。フェンス抽出・JSON 解釈・スキーマ検証、
// そしてユニットごとの BR 材料（construction ディレクトリの有無と rules.md）の
// 解決までをアダプタに委ね、use-case へは検査語彙だけを渡す。
//
// not-applicable は機能形式モデル以外への書き込み（pass-through）。unreadable は
// 材料が組めない失敗で、errors は verdict にそのまま載る凍結文言。

import type { DesignModelId, DesignUnitView } from "../domain/index.ts";

export interface DesignIrValidationMaterials {
  readonly irVersion: string;
  readonly schemaErrors: readonly string[];
  readonly units: readonly DesignUnitView[];
}

export type DesignIrMaterialsAcquisition =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "unreadable"; readonly errors: readonly string[] }
  | { readonly kind: "acquired"; readonly materials: DesignIrValidationMaterials };

export interface DesignIrValidationMaterialsRepository {
  acquire(id: DesignModelId): DesignIrMaterialsAcquisition;
}
