import type { Err } from "./err.ts";
import type { Ok } from "./ok.ts";


export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// 閉じた変種集合の網羅性の証人。ここへ到達するのは defect であって
// 予期される失敗ではない — domain 層で唯一許される throw。
export function unreachable(x: never): never {
  throw new Error(`defect: unreachable variant ${JSON.stringify(x)}`);
}
