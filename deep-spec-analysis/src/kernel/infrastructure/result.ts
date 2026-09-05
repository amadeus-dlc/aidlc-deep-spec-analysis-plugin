import type { ResultFailure } from "./result-failure.ts";
import type { ResultSuccess } from "./result-success.ts";


export type Result<T, E> = ResultSuccess<T> | ResultFailure<E>;

export function ok<T>(value: T): ResultSuccess<T> {
  return { ok: true, value };
}

export function err<E>(error: E): ResultFailure<E> {
  return { ok: false, error };
}

// 閉じた変種集合の網羅性の証人。ここへ到達するのは defect であって
// 予期される失敗ではない — domain 層で唯一許される throw。
export function unreachable(x: never): never {
  throw new Error(`defect: unreachable variant ${JSON.stringify(x)}`);
}
