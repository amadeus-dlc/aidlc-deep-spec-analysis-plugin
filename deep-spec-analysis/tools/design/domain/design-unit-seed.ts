import { AttrPaths } from "./attr-paths.ts";
import { DesignBackgroundAssumptions } from "./design-background-assumptions.ts";
import { DesignMachines } from "./design-machines.ts";
import { DesignObligations } from "./design-obligations.ts";
import { DesignScenarios } from "./design-scenarios.ts";
import type { DesignValue } from "./design-value.ts";

export interface DesignUnitSeed {
  readonly unit: string;
  readonly rawEntities: DesignValue;
  readonly attrPaths: AttrPaths;
  readonly obligations: DesignObligations;
  readonly machines: DesignMachines;
  readonly scenarios: DesignScenarios;
  readonly background: DesignBackgroundAssumptions;
}
