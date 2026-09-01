import { ComponentEntities } from "./component-entities.ts";
import { ComponentRefs } from "./component-refs.ts";
import { type ComponentName } from "./component-name.ts";
import { type ElementPath } from "./element-path.ts";

export interface Component {
  readonly name: ComponentName;
  readonly element: ElementPath;
  readonly dependsOn: ComponentRefs;
  readonly dependents: ComponentRefs;
  readonly entities: ComponentEntities;
}
