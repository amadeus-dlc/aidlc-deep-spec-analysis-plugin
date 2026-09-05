import type { SchemaUnreadable } from "./schema-unreadable.ts";
// 契約スキーマ（JSON Schema ファイル）の読込。合成ルートがパスを解決して
// 呼び、読めた Schema（または材料つきの失敗）をドメインへ注入する。
// cause の文言は集約の降格文言（golden 凍結）に逐語で載るため、捕捉した
// Error.message をそのまま運ぶ。

import { readFileSync } from "node:fs";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { type Schema } from "@deep-spec/kernel-infrastructure";
import { isObject } from "@deep-spec/kernel-infrastructure";
import { FindingsSchema } from "@deep-spec/kernel-domain";


export function readContractSchema(path: string): Result<Schema, SchemaUnreadable> {
  try {
    const document = JSON.parse(readFileSync(path, "utf-8"));
    if (!isObject(document)) return err({ cause: "contract schema must be a JSON object" });
    return ok(document);
  } catch (e) {
    return err({ cause: e instanceof Error ? e.message : String(e) });
  }
}

export function readFindingsSchema(path: string): FindingsSchema {
  const document = readContractSchema(path);
  if (!document.ok) return FindingsSchema.unreadable(document.error.cause);
  const parsed = FindingsSchema.parse(document.value);
  return parsed.ok ? parsed.value : FindingsSchema.unreadable(JSON.stringify(parsed.error));
}
