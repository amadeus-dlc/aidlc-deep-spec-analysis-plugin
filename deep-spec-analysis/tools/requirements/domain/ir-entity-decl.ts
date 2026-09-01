import { IrAttributeDecls } from "./ir-attribute-decls.ts";
import { IrEntityName } from "./ir-entity-name.ts";

export interface IrEntityDecl {
  readonly name: IrEntityName;
  readonly attributes: IrAttributeDecls;
}
