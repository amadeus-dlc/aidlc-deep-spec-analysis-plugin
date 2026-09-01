import type { AttributeBound } from "../../kernel/domain/index.ts";
import type { IrAttributeName } from "./ir-attribute-name.ts";
import type { IrDeclaredValues } from "./ir-declared-values.ts";

// IrAttributeDecl 構築ドアの引数（寛容パースが型付きに解体した材料）。
export interface IrAttributeDeclSeed {
  readonly name: IrAttributeName;
  readonly kind: string;
  readonly values?: IrDeclaredValues;
  readonly min?: AttributeBound;
  readonly max?: AttributeBound;
}
