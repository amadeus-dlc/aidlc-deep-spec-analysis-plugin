import { err, ok, type Result } from "./result.ts";

// 成否のフローを選ぶ。コールバックの仕事は呼び手が決め、ここでは捕捉・業務判断をしない。
export function matchResult<T, E, U>(
  result: Result<T, E>,
  cases: {
    readonly ok: (value: T) => U;
    readonly err: (error: E) => U;
  },
): U {
  return result.ok ? cases.ok(result.value) : cases.err(result.error);
}

export function flatMapResult<T, U, E>(result: Result<T, E>, next: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? next(result.value) : result;
}

// Result を値のまま合成する。失敗を例外に変換せず、生成処理のpanicも捕捉しない。
export function combineResults<T, E>(fields: { [K in keyof T]: Result<T[K], E> }): Result<T, E> {
  const values: Partial<T> = {};
  for (const key in fields) {
    const field = fields[key];
    if (!field.ok) return err(field.error);
    values[key] = field.value;
  }
  return ok(values as T);
}

export function traverseResult<T, V, E>(values: readonly T[], parse: (value: T) => Result<V, E>): Result<V[], E> {
  const parsed: V[] = [];
  for (const value of values) {
    const result = parse(value);
    if (!result.ok) return err(result.error);
    parsed.push(result.value);
  }
  return ok(parsed);
}
