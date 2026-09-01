import { EntityReferences } from "./entity-references.ts";
import { type AttributeName } from "./attribute-name.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";

export interface ComponentEntity {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly identifier: AttributeName | null;
  readonly references: EntityReferences;
}
