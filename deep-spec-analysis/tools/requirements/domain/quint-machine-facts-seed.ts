import { type ObligationIds } from "./obligation-ids.ts";
import { QuintMachineComponents } from "./quint-machine-components.ts";
import type { ScenarioId } from "./scenario-id.ts";

export interface QuintMachineFactsSeed {
  readonly invariantComponents: QuintMachineComponents;
  readonly eventIds: ObligationIds;
  readonly scenariosWithInit: readonly ScenarioId[];
}
