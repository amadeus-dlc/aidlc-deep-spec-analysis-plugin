// スキーマ属性の宣言（bool / 有界 int / enum）。逐語移動。パスと境界は
// ドメインプリミティブで運ぶ。




// AttributeBound は設計 decl 束と共有するため kernel へ移設（再輸出で面を保存）。
export { AttributeBound } from "../../kernel/domain/attribute-bound.ts";
import { AttributeBound } from "../../kernel/domain/attribute-bound.ts";
import { AttributePath } from "./attribute-path.ts";
import { AttributeValues } from "./attribute-values.ts";


export interface AttributeDeclaration {
  path: AttributePath;
  kind: "bool" | "int" | "enum";
  min?: AttributeBound;
  max?: AttributeBound;
  values?: AttributeValues;
}

