// contract-summary.md と units エッジブロックの型付き入力モデル（domain 語彙）。
// 解析（markdown テーブル/fence/YAML 歩き）はアダプタのパーサが行う。

export interface UnitDecl {
  name: string;
  dependsOn: string[];
}

// units エッジブロックの取得結果。absent は record に依存成果物が無い場合。
export type DeclaredUnitsOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unrecognized"; readonly error?: string }
  | { readonly kind: "declared"; readonly units: UnitDecl[] };

export interface ContractRow {
  id: string;
  provider: string;
  consumer: string;
  owner: string;
  line: number;
}

// contracts テーブルの取得結果（Provider 列を持つテーブルが無ければ absent）。
export type ContractsTableOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "rows"; readonly rows: ContractRow[] };

// 各 yaml spec ブロックの検査済み状態（CD-2 の判定材料）。
export interface SpecBlockAssessment {
  readonly index: number; // 1-based
  readonly line: number;
  readonly issue:
    | { readonly kind: "unparseable"; readonly error: string }
    | { readonly kind: "not-a-mapping" }
    | { readonly kind: "openapi-without-paths" }
    | null;
}
