import { DeclaredEntities } from "./declared-entities.ts";
export type EntitiesOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly model: DeclaredEntities };
