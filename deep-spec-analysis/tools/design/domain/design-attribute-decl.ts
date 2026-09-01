import type { AttributeBound } from "../../kernel/domain/index.ts";
import { DeclaredValues } from "./declared-values.ts";
import { type DesignAttributeName } from "./design-attribute-name.ts";

// 型宣言が欠けた属性は kind: "" で届く（旧実装はカタログへ登録した）。
export interface DesignAttributeDecl {
  readonly name: DesignAttributeName;
  readonly kind: string;
  readonly values?: DeclaredValues;
  readonly min?: AttributeBound;
  readonly max?: AttributeBound;
}
