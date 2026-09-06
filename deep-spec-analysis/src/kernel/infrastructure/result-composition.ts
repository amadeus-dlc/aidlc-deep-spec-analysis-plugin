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
  const values: object = Array.isArray(fields) ? new Array<T[keyof T]>(fields.length) : {};
  for (const key of Reflect.ownKeys(fields)) {
    if (Array.isArray(fields) && key === "length") continue;
    const field = fields[key as keyof typeof fields];
    if (!field.ok) return err(field.error);
    Object.defineProperty(values, key, {
      configurable: true,
      enumerable: true,
      value: field.value,
      writable: true,
    });
  }
  // Reflect.ownKeys と同じキー形状を T として表すことは TypeScript ではできないため、境界で形を戻す。
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
