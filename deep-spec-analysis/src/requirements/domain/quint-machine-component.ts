import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { ObligationId } from "./obligation-id.ts";
import { AttributePath } from "@deep-spec/kernel-domain";
import type { TraceState } from "./trace-state.ts";
import { TraceValue } from "./trace-value.ts";

// 不変量成分——invariant 系義務の assert、または state-temporal "always" 義務
// の assert が 1 成分として降りる。id はその義務の id。最終状態での帰属評価
// （成分が破れているか——評価不能も破れに数える凍結挙動）は成分自身の知識
// （#71 波10）。
// 式の純評価——トレースの状態に対して契約1 の式を評価する。未知演算子・欠損
// 参照は absent（null）に落ちる寛容評価（旧 evalExpr の凍結挙動）。成分の帰属
// 評価の内側（裁定 5、2026-09-02——旧随伴 class `ExpressionEvaluation` を吸収）。
// 値の意味論（真偽・数値化・等価）は TraceValue が持ち、評価器は問うだけ
//（裁定 2、2026-09-03）。
function evaluate(e: Expression, state: TraceState): TraceValue {
  const arg = (i: number): TraceValue => evaluate((e.args ?? [])[i] as Expression, state);
  switch (e.op) {
    case "and":
      return TraceValue.ofBoolean((e.args ?? []).every((a) => evaluate(a, state).isTrue()));
    case "or":
      return TraceValue.ofBoolean((e.args ?? []).some((a) => evaluate(a, state).isTrue()));
    case "not":
      return TraceValue.ofBoolean(!arg(0).isTrue());
    case "implies":
      return TraceValue.ofBoolean(!arg(0).isTrue() || arg(1).isTrue());
    case "iff":
      return TraceValue.ofBoolean(arg(0).isTrue() === arg(1).isTrue());
    case "eq":
      return TraceValue.ofBoolean(arg(0).equals(arg(1)));
    case "ne":
      return TraceValue.ofBoolean(!arg(0).equals(arg(1)));
    case "lt":
      return TraceValue.ofBoolean(arg(0).asNumber() < arg(1).asNumber());
    case "le":
      return TraceValue.ofBoolean(arg(0).asNumber() <= arg(1).asNumber());
    case "gt":
      return TraceValue.ofBoolean(arg(0).asNumber() > arg(1).asNumber());
    case "ge":
      return TraceValue.ofBoolean(arg(0).asNumber() >= arg(1).asNumber());
    case "add":
      return TraceValue.ofNumber(arg(0).asNumber() + arg(1).asNumber());
    case "sub":
      return TraceValue.ofNumber(arg(0).asNumber() - arg(1).asNumber());
    case "mul":
      return TraceValue.ofNumber(arg(0).asNumber() * arg(1).asNumber());
    case "ref":
      return state.valueAt(AttributePath.reconstitute(e.path ?? ""));
    case "bool":
    case "int":
    case "enum":
      return TraceValue.ofLiteral(e.value);
    default:
      return TraceValue.absent();
  }
}

export class QuintMachineComponent {
  readonly #id: ObligationId;
  readonly #expression: Expression;

  private constructor(props: { id: ObligationId; expression: Expression }) {
    this.#id = props.id;
    this.#expression = ExpressionTree.of(props.expression).asExpression();
  }

  static reconstitute(props: { id: ObligationId; expression: Expression }): QuintMachineComponent {
    return new QuintMachineComponent(props);
  }

  id(): ObligationId {
    return this.#id;
  }

  isViolatedIn(state: TraceState): boolean {
    return !evaluate(this.#expression, state).isTrue();
  }
}
