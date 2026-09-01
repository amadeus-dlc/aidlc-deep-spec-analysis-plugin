import { type ComponentName } from "./component-name.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";

export interface EntityReference {
  readonly entity: EntityName;
  readonly ownedBy: ComponentName;
  readonly element: ElementPath;
}
