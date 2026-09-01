import { type ObligationIds } from "./obligation-ids.ts";
import { QuintMachineComponents } from "./quint-machine-components.ts";

export interface QuintMachineFactsSeed {
  readonly invariantComponents: QuintMachineComponents;
  readonly eventIds: ObligationIds;
  readonly scenariosWithInit: ReadonlySet<string>;
}
