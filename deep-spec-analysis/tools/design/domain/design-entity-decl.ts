import { DesignAttributeDecls } from "./design-attribute-decls.ts";
import { type DesignEntityName } from "./design-entity-name.ts";

export interface DesignEntityDecl {
  readonly name: DesignEntityName;
  readonly attributes: DesignAttributeDecls;
}
