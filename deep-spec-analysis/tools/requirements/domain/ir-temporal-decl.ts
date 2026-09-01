import type { Expression } from "../../kernel/domain/index.ts";

export interface IrTemporalDecl {
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
}
