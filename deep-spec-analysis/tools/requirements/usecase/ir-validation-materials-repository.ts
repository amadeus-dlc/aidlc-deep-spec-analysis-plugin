// 契約1 IR の検査材料の取得ポート。成果物パス（識別）から、フェンス抽出・
// JSON 解釈・スキーマ検証までを済ませた材料を解決する。「Json をどう読むか」
// と「スキーマをどう当てるか」はアダプタの知識なので、ポートは検査語彙だけを
// 話す——view は well-formedness の材料、schemaErrors は凍結文言の列。
//
// not-applicable は形式モデル以外への書き込み（センサーの pass-through）。
// unreadable は材料が組めない失敗で、errors は verdict にそのまま載る凍結文言。

import type { FrRefClaim, IrModelView } from "../domain/index.ts";

export interface IrValidationMaterials {
  readonly irVersion: string;
  readonly schemaErrors: readonly string[];
  readonly view: IrModelView;
  readonly frClaims: readonly FrRefClaim[];
  // IR の sourceDigest。文字列でなければ null。
  readonly declaredDigest: string | null;
}

export type IrMaterialsAcquisition =
  | { readonly kind: "not-applicable" }
  | { readonly kind: "unreadable"; readonly errors: readonly string[] }
  | { readonly kind: "acquired"; readonly materials: IrValidationMaterials };

export interface IrValidationMaterialsRepository {
  acquire(outputPath: string): IrMaterialsAcquisition;
}

// 形式化の根拠となった requirements.md。id 集合とバイト列のダイジェストだけを
// 運ぶ（探索とバイト読みはアダプタ）。
export interface RequirementsSource {
  readonly knownIds: ReadonlySet<string>;
  readonly digest: string;
}

export interface RequirementsSourceRepository {
  resolve(outputPath: string): RequirementsSource | null;
}
