// Json 値 — 全契約（1〜4）の文書が流れる共通の再帰ユニオン。
// deep-spec-lib.ts からの逐語移動（DDD 移行 PR1、issue #14）。

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// JSON 配列から string 要素だけを選別する寛容パースの定型(5 アダプタで
// 重複していた一行を単一定義へ——PR10 重複監査)。
export const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);
