// Json 値 — 全契約（1〜4）の文書が流れる共通の再帰ユニオン。
// deep-spec-lib.ts からの逐語移動（DDD 移行 PR1、issue #14）。

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
