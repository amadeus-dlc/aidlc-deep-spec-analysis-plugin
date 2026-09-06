import type { ResultFailure } from "./result-failure.ts";
import type { ResultSuccess } from "./result-success.ts";

export type Result<T, E> = ResultSuccess<T> | ResultFailure<E>;

export function ok<T>(value: T): ResultSuccess<T> {
  return { ok: true, value };
}

export function err<E>(error: E): ResultFailure<E> {
  return { ok: false, error };
}

// 閉じた変種集合を網羅した分岐の到達不能点。到達した場合は実装の欠陥としてpanicする。
export function unreachable(x: never): never {
  throw new Error(`defect: unreachable variant ${JSON.stringify(x)}`);
}
