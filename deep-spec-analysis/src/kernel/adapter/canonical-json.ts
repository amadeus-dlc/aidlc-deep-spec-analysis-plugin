// 正準 JSON 直列化 — キー整列・配列順保存。irHash 系の入力バイトを决める
// ため 1 文字も変えてはならない。deep-spec-lib.ts からの逐語移動。

import { type Json, isObject } from "./json.ts";

export function canonicalStringify(value: Json): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
