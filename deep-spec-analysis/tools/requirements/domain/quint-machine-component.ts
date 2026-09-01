import type { Expression } from "../../kernel/domain/expression.ts";

export interface QuintMachineComponent {
  readonly id: string;
  readonly expr: Expression;
  readonly frRefs: readonly string[];
}
