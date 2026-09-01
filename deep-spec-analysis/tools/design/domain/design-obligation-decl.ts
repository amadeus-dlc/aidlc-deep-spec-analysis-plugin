import type { Expression } from "../../kernel/domain/index.ts";
import { BrRefs } from "./br-refs.ts";
import { type DesignObligationId } from "./design-obligation-id.ts";
import { type DesignObligationOrigin } from "./design-obligation-origin.ts";
import type { DesignTemporalDecl } from "./design-temporal-decl.ts";

export interface DesignObligationDecl {
  readonly id: DesignObligationId;
  readonly origin?: DesignObligationOrigin;
  // brRefs が配列でなければ undefined（origin:"rules" の必須チェックに使う）。
  readonly brRefs?: BrRefs;
  readonly assert?: Expression;
  readonly guard?: Expression;
  readonly effect?: Expression;
  readonly temporal?: DesignTemporalDecl;
}
