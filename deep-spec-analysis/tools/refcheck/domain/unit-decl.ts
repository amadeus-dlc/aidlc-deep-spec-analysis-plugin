import { UnitNames } from "./unit-names.ts";
import type { UnitName } from "./unit-name.ts";

export interface UnitDecl {
  readonly name: UnitName;
  readonly dependsOn: UnitNames;
}
