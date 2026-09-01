import { UnitDecls } from "./unit-decls.ts";
// units エッジブロックの取得結果。absent は record に依存成果物が無い場合。
export type DeclaredUnitsOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unrecognized"; readonly error?: string }
  | { readonly kind: "declared"; readonly units: UnitDecls };
