// ITF（Informal Trace Format）の decode — 形式知識はここに封じ、ドメインへは
// 「属性パス → 復号済み値」のトレース状態だけを渡す。#bigint は数値へ、
// # 始まりのメタキーは落とし、変数名は varToPath で属性パスへ戻す。
// 旧 decodeItfValue / decodeItfTrace / itfStatus からの逐語移植。

import { type Json, type Result, err, ok, isObject } from "@deep-spec/kernel-infrastructure";
import { AttributePath, TraceState, TraceValue } from "@deep-spec/requirements-domain";

function decodeItfValue(v: Json): Json {
  if (isObject(v) && typeof v["#bigint"] === "string") return Number.parseInt(v["#bigint"], 10);
  return v;
}

export function decodeItfTrace(itfText: string, varToPath: Map<string, string>): Result<TraceState[], string> {
  if (itfText.length > 16_777_216) return err("ITF document exceeds the 16 Mi code-unit budget");
  let doc: Json;
  try { doc = JSON.parse(itfText) as Json; } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return err(error.message);
  }
  if (!isObject(doc) || !Array.isArray(doc.states)) return ok([]);
  const trace: TraceState[] = [];
  for (const state of doc.states) {
    if (!isObject(state)) continue;
    const entries: (readonly [AttributePath, TraceValue])[] = [];
    for (const key of Object.keys(state).sort()) {
      if (key.startsWith("#")) continue;
      const path = varToPath.get(key) ?? key;
      const attributePath = AttributePath.parse(path);
      if (!attributePath.ok) return err(JSON.stringify(attributePath.error));
      const value = TraceValue.parse(decodeItfValue(state[key] ?? null));
      if (!value.ok) return err(JSON.stringify(value.error));
      entries.push([attributePath.value, value.value]);
    }
    trace.push(TraceState.of(entries));
  }
  return ok(trace);
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
