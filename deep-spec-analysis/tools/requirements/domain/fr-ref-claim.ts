import type { FrRefs } from "../../kernel/domain/index.ts";

export interface FrRefClaim {
  readonly owner: string;
  readonly frRefs: FrRefs;
}
