import type { Expression } from "../../kernel/domain/expression.ts";
import { BackgroundAssumptionId } from "./background-assumption-id.ts";

export interface BackgroundAssumption {
  id: BackgroundAssumptionId;
  assert: Expression;
}
