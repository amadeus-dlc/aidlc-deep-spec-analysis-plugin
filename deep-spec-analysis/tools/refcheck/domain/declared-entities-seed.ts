import { EntityDecls } from "./entity-decls.ts";
import { RelDecls } from "./rel-decls.ts";
import { ShapeErrors } from "./shape-errors.ts";

export interface DeclaredEntitiesSeed {
  readonly entities: EntityDecls;
  readonly rels: RelDecls; // top-level relationships
  readonly shapeErrors: ShapeErrors;
}
