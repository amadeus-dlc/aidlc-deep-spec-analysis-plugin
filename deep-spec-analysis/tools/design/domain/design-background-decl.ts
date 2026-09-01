import type { Expression } from "../../kernel/domain/index.ts";
import { type DesignBackgroundId } from "./design-background-id.ts";

export interface DesignBackgroundDecl {
  readonly id: DesignBackgroundId;
  readonly assert?: Expression;
}
