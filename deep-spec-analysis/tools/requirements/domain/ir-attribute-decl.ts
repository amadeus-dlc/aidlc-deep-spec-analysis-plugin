import type { AttributeBound } from "../../kernel/domain/index.ts";
import { IrAttributeName } from "./ir-attribute-name.ts";
import { IrDeclaredValues } from "./ir-declared-values.ts";

// 型宣言が欠けた属性は kind: "" として届く（旧実装は type 欠落でも属性を
// カタログへ登録した——参照解決の可否がそれで変わるため保存する）。
export interface IrAttributeDecl {
  readonly name: IrAttributeName;
  readonly kind: string;
  readonly values?: IrDeclaredValues;
  readonly min?: AttributeBound;
  readonly max?: AttributeBound;
}
