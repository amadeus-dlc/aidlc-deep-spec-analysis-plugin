import type { Expression } from "../../kernel/domain/index.ts";
import { DesignBackgroundId } from "./design-background-id.ts";

export interface DesignBackgroundAssumption {
  id: DesignBackgroundId;
  assert: Expression;
}
