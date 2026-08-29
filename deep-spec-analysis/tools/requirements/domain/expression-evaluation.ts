// 式の純評価 — トレースの状態に対して契約1 の式を評価し、違反した不変量
// 成分を帰属させるためのドメインサービス。未知演算子・欠損参照は null に
// 落ちる寛容評価（旧 evalExpr の凍結挙動）。
// 旧 aidlc-sensor-deep-spec-verify-quint.ts の evalExpr からの逐語移植。

import type { Expression } from "../../kernel/domain/expression.ts";
import type { DecodedValue, TraceState } from "./trace-state.ts";

export function evaluateExpression(e: Expression, state: TraceState): DecodedValue {
  const arg = (i: number): DecodedValue => evaluateExpression((e.args ?? [])[i] as Expression, state);
  const asBool = (v: DecodedValue): boolean => v === true;
  const asNum = (v: DecodedValue): number => (typeof v === "number" ? v : Number.NaN);
  switch (e.op) {
    case "and":
      return (e.args ?? []).every((a) => asBool(evaluateExpression(a, state)));
    case "or":
      return (e.args ?? []).some((a) => asBool(evaluateExpression(a, state)));
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
