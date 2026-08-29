// ITF（Informal Trace Format）の decode — 形式知識はここに封じ、ドメインへは
// 「属性パス → 復号済み値」のトレース状態だけを渡す。#bigint は数値へ、
// # 始まりのメタキーは落とし、変数名は varToPath で属性パスへ戻す。
// 旧 decodeItfValue / decodeItfTrace / itfStatus からの逐語移植。

import { type Json, isObject } from "../../kernel/adapter/index.ts";
import type { DecodedValue, TraceState } from "../domain/index.ts";

function decodeItfValue(v: Json): Json {
  if (isObject(v) && typeof v["#bigint"] === "string") return Number.parseInt(v["#bigint"], 10);
  return v;
}

export function decodeItfTrace(itfText: string, varToPath: Map<string, string>): TraceState[] {
  const doc = JSON.parse(itfText) as Json;
  if (!isObject(doc) || !Array.isArray(doc.states)) return [];
  const trace: TraceState[] = [];
  for (const state of doc.states) {
    if (!isObject(state)) continue;
    const decoded: TraceState = {};
    for (const key of Object.keys(state).sort()) {
      if (key.startsWith("#")) continue;
      const path = varToPath.get(key) ?? key;
      decoded[path] = decodeItfValue(state[key] ?? null) as DecodedValue;
    }
    trace.push(decoded);
  }
  return trace;
}

export function itfStatus(itfText: string): string {
  try {
    const doc = JSON.parse(itfText) as Json;
    if (isObject(doc) && isObject(doc["#meta"]) && typeof doc["#meta"].status === "string") {
      return doc["#meta"].status;
    }
  } catch {
    // fallthrough
  }
  return "";
}
