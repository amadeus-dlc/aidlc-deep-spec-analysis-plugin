import type { Expression } from "../../kernel/domain/index.ts";
import type { IrTemporalDecl } from "./ir-temporal-decl.ts";
import { type ObligationId } from "./obligation-id.ts";

export interface IrObligationDecl {
  readonly id: ObligationId;
  readonly assert?: Expression;
  readonly guard?: Expression;
  readonly effect?: Expression;
  readonly temporal?: IrTemporalDecl;
}
