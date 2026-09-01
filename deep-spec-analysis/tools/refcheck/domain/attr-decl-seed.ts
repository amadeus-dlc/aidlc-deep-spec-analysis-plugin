import { type AllowedValues } from "./allowed-values.ts";
import { type AttributeDefault } from "./attribute-default.ts";
import { type AttributeName } from "./attribute-name.ts";
import { type ElementPath } from "./element-path.ts";
import { type NumericBound } from "./numeric-bound.ts";
import { type ReferenceTarget } from "./reference-target.ts";
import { type TypeName } from "./type-name.ts";

// ---- entities.md ------------------------------------------------------------

export interface AttrDeclSeed {
  readonly name: AttributeName;
  readonly element: ElementPath;
  readonly type: TypeName | null;
  readonly uniqueIsTrue: boolean;
  readonly references: ReferenceTarget | null;
  readonly allowed: AllowedValues | null;
  readonly def: AttributeDefault | null;
  readonly minDeclared: boolean;
  readonly maxDeclared: boolean;
  readonly min: NumericBound | null;
  readonly max: NumericBound | null;
}
