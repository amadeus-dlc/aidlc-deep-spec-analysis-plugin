import type { Expression } from "../../kernel/domain/index.ts";
import { type BackgroundAssumptionId } from "./background-assumption-id.ts";

export interface IrBackgroundDecl {
  readonly id: BackgroundAssumptionId;
  readonly assert?: Expression;
}
