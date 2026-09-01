import { AttrDecls } from "./attr-decls.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";
import { RelDecls } from "./rel-decls.ts";

export interface EntityDeclSeed {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly attrs: AttrDecls;
  readonly rels: RelDecls;
}
