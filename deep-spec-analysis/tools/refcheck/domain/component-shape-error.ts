import { type ElementPath } from "./element-path.ts";

export interface ComponentShapeError {
  readonly element: ElementPath;
  readonly detail: string;
}
