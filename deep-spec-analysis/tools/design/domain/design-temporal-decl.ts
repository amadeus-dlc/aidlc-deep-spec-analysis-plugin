import type { Expression } from "../../kernel/domain/index.ts";

export interface DesignTemporalDecl {
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
}
