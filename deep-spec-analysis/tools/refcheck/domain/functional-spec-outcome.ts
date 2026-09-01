import { StateMachineSketches } from "./state-machine-sketches.ts";
export type FunctionalSpecOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly machines: StateMachineSketches };
