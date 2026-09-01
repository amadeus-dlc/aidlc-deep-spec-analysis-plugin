import type { Expression } from "../../kernel/domain/index.ts";
import { DesignAssignments } from "./design-assignments.ts";

export interface DesignEvent {
  guard: Expression;
  effectAssign: DesignAssignments;
}
