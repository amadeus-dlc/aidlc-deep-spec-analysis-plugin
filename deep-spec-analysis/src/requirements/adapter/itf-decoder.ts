// ITF（Informal Trace Format）の decode — 形式知識はここに封じ、ドメインへは
// 「属性パス → 復号済み値」のトレース状態だけを渡す。#bigint は数値へ、
// # 始まりのメタキーは落とし、変数名は varToPath で属性パスへ戻す。

import { err, isObject, type Json, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import {
  AttributePath,
  TraceState,
  TraceStateEntry,
  TraceStates,
  TraceValue,
} from "@deep-spec-analysis/requirements-domain";

function decodeItfValue(v: Json): Json {
  if (isObject(v) && typeof v["#bigint"] === "string") return Number.parseInt(v["#bigint"], 10);
  return v;
}

export function decodeItfTrace(itfText: string, varToPath: Map<string, string>): Result<TraceStates, string> {
  if (itfText.length > 16_777_216) return err("ITF document exceeds the 16 Mi code-unit budget");
  let doc: Json;
  try {
    doc = JSON.parse(itfText) as Json;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return err(error.message);
  }
  const states = isObject(doc) && Array.isArray(doc.states) ? doc.states : [];
  const trace: TraceState[] = [];
  for (const state of states) {
    if (!isObject(state)) continue;
    const entries: TraceStateEntry[] = [];
    for (const key of Object.keys(state).sort()) {
      if (key.startsWith("#")) continue;
      const path = varToPath.get(key) ?? key;
      const attributePath = AttributePath.parse(path);
      if (!attributePath.ok) return err(JSON.stringify(attributePath.error));
      const value = TraceValue.parse(decodeItfValue(state[key] ?? null));
      if (!value.ok) return err(JSON.stringify(value.error));
      entries.push(TraceStateEntry.of(attributePath.value, value.value));
    }
    const parsedState = TraceState.parse(entries);
    if (!parsedState.ok) return err(JSON.stringify(parsedState.error));
    trace.push(parsedState.value);
  }
  const parsedTrace = TraceStates.parse(trace);
  return parsedTrace.ok ? ok(parsedTrace.value) : err(JSON.stringify(parsedTrace.error));
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
