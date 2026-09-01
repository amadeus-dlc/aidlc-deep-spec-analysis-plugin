import { type CardinalityNotation } from "./cardinality-notation.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";

export interface RelDeclSeed {
  readonly element: ElementPath;
  readonly from: EntityName | null;
  readonly to: EntityName | null;
  readonly cardinality: CardinalityNotation | null;
  readonly hasDirection: boolean;
}
