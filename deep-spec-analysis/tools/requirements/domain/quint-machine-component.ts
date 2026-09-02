import type { Expression } from "../../kernel/domain/expression.ts";
import { ExpressionEvaluation } from "./expression-evaluation.ts";
import type { ObligationId } from "./obligation-id.ts";
import type { TraceState } from "./trace-state.ts";

// 不変量成分——invariant 系義務の assert、または state-temporal "always" 義務
// の assert が 1 成分として降りる。id はその義務の id。最終状態での帰属評価
// （成分が破れているか——評価不能も破れに数える凍結挙動）は成分自身の知識
// （#71 波10）。
export class QuintMachineComponent {
  readonly #id: ObligationId;
  readonly #expression: Expression;

  private constructor(props: { id: ObligationId; expression: Expression }) {
    this.#id = props.id;
    this.#expression = props.expression;
  }

  static reconstitute(props: { id: ObligationId; expression: Expression }): QuintMachineComponent {
    return new QuintMachineComponent(props);
  }

  id(): ObligationId {
    return this.#id;
  }

  isViolatedIn(state: TraceState): boolean {
    return ExpressionEvaluation.evaluate(this.#expression, state) !== true;
  }
}
