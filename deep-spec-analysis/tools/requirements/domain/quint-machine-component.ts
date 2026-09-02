import type { Expression } from "../../kernel/domain/expression.ts";
import type { DecodedValue } from "./decoded-value.ts";
import type { ObligationId } from "./obligation-id.ts";
import type { TraceState } from "./trace-state.ts";

// 不変量成分——invariant 系義務の assert、または state-temporal "always" 義務
// の assert が 1 成分として降りる。id はその義務の id。最終状態での帰属評価
// （成分が破れているか——評価不能も破れに数える凍結挙動）は成分自身の知識
// （#71 波10）。
// 式の純評価——トレースの状態に対して契約1 の式を評価する。未知演算子・欠損
// 参照は null に落ちる寛容評価（旧 evalExpr の凍結挙動）。成分の帰属評価の
// 内側（裁定 5、2026-09-02——旧随伴 class `ExpressionEvaluation` を吸収）。
function evaluate(e: Expression, state: TraceState): DecodedValue {
  const arg = (i: number): DecodedValue => evaluate((e.args ?? [])[i] as Expression, state);
  const asBool = (v: DecodedValue): boolean => v === true;
  const asNum = (v: DecodedValue): number => (typeof v === "number" ? v : Number.NaN);
  switch (e.op) {
    case "and":
      return (e.args ?? []).every((a) => asBool(evaluate(a, state)));
    case "or":
      return (e.args ?? []).some((a) => asBool(evaluate(a, state)));
    case "not":
      return !asBool(arg(0));
    case "implies":
      return !asBool(arg(0)) || asBool(arg(1));
    case "iff":
      return asBool(arg(0)) === asBool(arg(1));
    case "eq":
      return JSON.stringify(arg(0)) === JSON.stringify(arg(1));
    case "ne":
      return JSON.stringify(arg(0)) !== JSON.stringify(arg(1));
    case "lt":
      return asNum(arg(0)) < asNum(arg(1));
    case "le":
      return asNum(arg(0)) <= asNum(arg(1));
    case "gt":
      return asNum(arg(0)) > asNum(arg(1));
    case "ge":
      return asNum(arg(0)) >= asNum(arg(1));
    case "add":
      return asNum(arg(0)) + asNum(arg(1));
    case "sub":
      return asNum(arg(0)) - asNum(arg(1));
    case "mul":
      return asNum(arg(0)) * asNum(arg(1));
    case "ref":
      return state[e.path ?? ""] ?? null;
    case "bool":
    case "int":
    case "enum":
      return e.value ?? null;
    default:
      return null;
  }
}

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
    return evaluate(this.#expression, state) !== true;
  }
}
