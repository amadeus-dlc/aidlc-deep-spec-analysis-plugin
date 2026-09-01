import type { AttributeBound } from "../../kernel/domain/index.ts";
import type { DeclaredValues } from "./declared-values.ts";
import type { DesignAttributeName } from "./design-attribute-name.ts";

// DesignAttributeDecl 構築ドアの引数（寛容パースが型付きに解体した材料）。
export interface DesignAttributeDeclSeed {
  readonly name: DesignAttributeName;
  readonly kind: string;
  readonly values?: DeclaredValues;
  readonly min?: AttributeBound;
  readonly max?: AttributeBound;
}
