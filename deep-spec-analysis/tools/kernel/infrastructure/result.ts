// Result — ハウスのエラーチャネル（言語拡張：ドメインを知らない）。
// domain / use-case 層の「予期される失敗」はすべて Result で返す。
// throw は defect（到達し得ないはずの分岐）専用で、その唯一の口が
// unreachable。コンビネータは置かない — Err<E> は任意の Result<T2, E> に
// 代入可能なので、伝播は早期 return（`if (!r.ok) return r;`）で足りる。
// 第 2 の方言（map/andThen チェーン）を作らないための意図的な最小 API。

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

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
