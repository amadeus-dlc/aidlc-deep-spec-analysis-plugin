import type { Expression } from "@deep-spec/kernel-domain";
import { AttributePath, ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import type { ObligationIdentifier } from "./obligation-identifier.ts";

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
      return TraceValue.of((e.args ?? []).every((a) => evaluate(a, state).isTrue()));
    case "or":
      return TraceValue.of((e.args ?? []).some((a) => evaluate(a, state).isTrue()));
    case "not":
      return TraceValue.of(!arg(0).isTrue());
    case "implies":
      return TraceValue.of(!arg(0).isTrue() || arg(1).isTrue());
    case "iff":
      return TraceValue.of(arg(0).isTrue() === arg(1).isTrue());
    case "eq":
      return TraceValue.of(arg(0).equals(arg(1)));
    case "ne":
      return TraceValue.of(!arg(0).equals(arg(1)));
    case "lt":
      return TraceValue.of(arg(0).asNumber() < arg(1).asNumber());
    case "le":
      return TraceValue.of(arg(0).asNumber() <= arg(1).asNumber());
    case "gt":
      return TraceValue.of(arg(0).asNumber() > arg(1).asNumber());
    case "ge":
      return TraceValue.of(arg(0).asNumber() >= arg(1).asNumber());
    case "add":
      return TraceValue.of(arg(0).asNumber() + arg(1).asNumber());
    case "sub":
      return TraceValue.of(arg(0).asNumber() - arg(1).asNumber());
    case "mul":
      return TraceValue.of(arg(0).asNumber() * arg(1).asNumber());
    case "ref":
      return state.valueAt(AttributePath.of(e.path ?? ""));
    case "bool":
    case "int":
    case "enum":
      return TraceValue.of(e.value ?? null);
    default:
      return TraceValue.absent();
  }
}

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type QuintMachineComponentParam = { id: ObligationIdentifier; expression: Expression };

export class QuintMachineComponent {
  readonly #id: ObligationIdentifier;
  readonly #expression: Expression;

  private constructor(props: QuintMachineComponentParam) {
    this.#id = props.id;
    this.#expression = ExpressionTree.of(props.expression).asExpression();
  }

  static parse(props: QuintMachineComponentParam): Result<QuintMachineComponent, ParseError> {
    return parseConstruction(() => new QuintMachineComponent(props));
  }

  static of(props: QuintMachineComponentParam): QuintMachineComponent {
    return new QuintMachineComponent(props);
  }

  id(): ObligationIdentifier {
    return this.#id;
  }

  isViolatedIn(state: TraceState): boolean {
    return !evaluate(this.#expression, state).isTrue();
  }
}
