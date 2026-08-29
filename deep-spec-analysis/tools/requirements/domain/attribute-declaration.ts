// スキーマ属性の宣言（bool / 有界 int / enum）。逐語移動。

export interface AttributeDeclaration {
  path: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  values?: string[];
}
