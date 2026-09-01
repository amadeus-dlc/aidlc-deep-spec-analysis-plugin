import { type ElementPath } from "./element-path.ts";

export interface ShapeError {
  readonly element: ElementPath;
  readonly detail: string;
}
