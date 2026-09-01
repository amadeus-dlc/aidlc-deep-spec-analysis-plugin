import { type ComponentName } from "./component-name.ts";
import { type ElementPath } from "./element-path.ts";

export interface ComponentRef {
  readonly component: ComponentName;
  readonly element: ElementPath;
}
