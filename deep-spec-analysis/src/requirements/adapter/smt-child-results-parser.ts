import { type Json, type Result, err, isObject, ok } from "@deep-spec/kernel-infrastructure";
import type { SmtChildResult } from "./smt-child-result.ts";

// 子プロセスの応答を、発行済みクエリと一対一に対応する結果集合へ復号する。
// ドメイン生成のpanicは捕捉せず、外部プロトコルの不正をResultで返す。
export function parseSmtChildResults(raw: Json, expectedIds: readonly string[]): Result<Map<string, SmtChildResult>, string> {
  if (!isObject(raw) || !Array.isArray(raw.results)) return err("solver child response lacks a results array");
  const expected = new Set(expectedIds);
  const results = new Map<string, SmtChildResult>();
  for (const item of raw.results) {
    if (!isObject(item) || typeof item.id !== "string") return err("solver child result lacks a query id");
    if (!expected.has(item.id)) return err(`solver child returned unexpected query ${item.id}`);
    if (results.has(item.id)) return err(`solver child returned duplicate query ${item.id}`);
    const status = item.status;
    if (status !== "sat" && status !== "unsat" && status !== "unknown" && status !== "budget" && status !== "error") {
      return err(`solver child returned an invalid status for query ${item.id}`);
    }
    if (item.model !== undefined && (!isObject(item.model) || !Object.values(item.model).every((value) => typeof value === "string"))) {
      return err(`solver child returned an invalid model for query ${item.id}`);
    }
    if (item.core !== undefined && (!Array.isArray(item.core) || !item.core.every((value) => typeof value === "string"))) {
      return err(`solver child returned an invalid core for query ${item.id}`);
    }
    if (item.error !== undefined && typeof item.error !== "string") return err(`solver child returned an invalid error for query ${item.id}`);
    results.set(item.id, {
      id: item.id, status,
      ...(item.model !== undefined ? { model: item.model as Record<string, string> } : {}),
      ...(item.core !== undefined ? { core: item.core as string[] } : {}),
      ...(item.error !== undefined ? { error: item.error } : {}),
    });
  }
  const missing = expectedIds.filter((id) => !results.has(id));
  if (missing.length > 0) return err(`solver child omitted query results: ${missing.join(", ")}`);
  if (results.size !== expectedIds.length) return err("solver query ids are not unique");
  return ok(results);
}
