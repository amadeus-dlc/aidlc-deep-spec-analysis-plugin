import { type AttributeNames } from "./attribute-names.ts";
import { type ComponentName } from "./component-name.ts";
import { type EntityName } from "./entity-name.ts";

// ---- components.md (XS) -----------------------------------------------------

export interface DomainEntitySketchSeed {
  readonly name: EntityName;
  readonly component: ComponentName;
  readonly attributes: AttributeNames;
}
