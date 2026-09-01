import { DomainEntitySketches } from "./domain-entity-sketches.ts";
export type DomainEntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly error: string }
  | { readonly kind: "extracted"; readonly entities: DomainEntitySketches };
