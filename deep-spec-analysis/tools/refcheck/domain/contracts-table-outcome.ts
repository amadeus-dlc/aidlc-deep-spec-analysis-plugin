import { ContractRows } from "./contract-rows.ts";
// contracts テーブルの取得結果（Provider 列を持つテーブルが無ければ absent）。
export type ContractsTableOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "rows"; readonly rows: ContractRows };
