import { err, isObject, type Json, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { SolverChildResult } from "./solver-child-result.ts";

const MAX_RESULTS = 65_536;
const MAX_QUERY_ID_LENGTH = 2048;
const MAX_VALUE_NODES = 65_536;
const MAX_VALUE_STRING = 65_536;
const MAX_VALUE_TOTAL_TEXT = 16_777_216;

interface ValueBudget {
  nodes: number;
  totalText: number;
}

function consumeNode(budget: ValueBudget, field: string): string | null {
  budget.nodes++;
  return budget.nodes > MAX_VALUE_NODES ? `solver child ${field} exceeds the value node budget` : null;
}

function consumeText(budget: ValueBudget, field: string, value: string): string | null {
  if (value.length > MAX_VALUE_STRING) return `solver child ${field} contains an oversized string`;
  budget.totalText += value.length;
  return budget.totalText > MAX_VALUE_TOTAL_TEXT ? `solver child ${field} exceeds the total text budget` : null;
}

function consumeString(budget: ValueBudget, field: string, value: string): string | null {
  return consumeNode(budget, field) ?? consumeText(budget, field, value);
}

function copyModel(raw: { [name: string]: Json }, budget: ValueBudget): Result<{ [name: string]: string }, string> {
  const nodeError = consumeNode(budget, "model");
  if (nodeError !== null) return err(nodeError);
  const entries: [string, string][] = [];
  for (const name in raw) {
    if (!Object.hasOwn(raw, name)) continue;
    const keyError = consumeText(budget, "model key", name);
    if (keyError !== null) return err(keyError);
    const value = raw[name];
    if (typeof value !== "string") return err("solver child returned an invalid model");
    const valueError = consumeString(budget, "model value", value);
    if (valueError !== null) return err(valueError);
    entries.push([name, value]);
  }
  return ok(Object.fromEntries(entries));
}

function copyCore(raw: Json[], budget: ValueBudget): Result<string[], string> {
  if (raw.length > MAX_VALUE_NODES) return err("solver child core exceeds the value node budget");
  const nodeError = consumeNode(budget, "core");
  if (nodeError !== null) return err(nodeError);
  const core: string[] = [];
  for (let index = 0; index < raw.length; index++) {
    const value = raw[index];
    if (typeof value !== "string") return err("solver child returned an invalid core");
    const valueError = consumeString(budget, "core value", value);
    if (valueError !== null) return err(valueError);
    core.push(value);
  }
  return ok(core);
}

/**
 * 発行済みクエリと応答を一対一に対応させる。集合は65,536件、IDはQueryLabelと同じ2,048コード単位まで。
 * 1結果のmodel/core/errorは合計65,536ノード、文字列65,536、全テキスト16Miコード単位。
 * 容器と値をノードとして数え、キーはテキスト予算へ含める。証拠文書を構築する前の復号・コピー予算である。
 */
export function parseSolverChildResults(
  raw: Json,
  expectedIds: readonly string[],
): Result<Map<string, SolverChildResult>, string> {
  if (!isObject(raw)) return err("solver child response lacks a results array");
  const resultItems = raw.results;
  if (!Array.isArray(resultItems)) return err("solver child response lacks a results array");
  if (expectedIds.length > MAX_RESULTS) return err("solver child expected query set exceeds 65,536 entries");
  if (resultItems.length > MAX_RESULTS) return err("solver child response has too-many-results");
  const expectedIdsSnapshot: string[] = [];
  let expectedInspected = 0;
  for (const id of expectedIds) {
    if (++expectedInspected > MAX_RESULTS) return err("solver child expected query set exceeds 65,536 entries");
    if (id.length > MAX_QUERY_ID_LENGTH) return err("solver child expected query id is too long");
    expectedIdsSnapshot.push(id);
  }
  if (expectedInspected !== expectedIds.length)
    return err("solver child expected query set length does not match its iteration");
  const expected = new Set(expectedIdsSnapshot);
  if (expected.size !== expectedIdsSnapshot.length) return err("solver query ids are not unique");
  const items: { item: { [key: string]: Json }; id: string }[] = [];
  const resultIds = new Set<string>();
  for (let index = 0; index < resultItems.length; index++) {
    const item = resultItems[index];
    if (!isObject(item)) return err("solver child result lacks a query id");
    const id = item.id;
    if (typeof id !== "string") return err("solver child result lacks a query id");
    if (id.length > MAX_QUERY_ID_LENGTH) return err("solver child returned an oversized query id");
    if (!expected.has(id)) return err(`solver child returned unexpected query ${id}`);
    if (resultIds.has(id)) return err(`solver child returned duplicate query ${id}`);
    resultIds.add(id);
    items.push({ item, id });
  }
  const missing = expectedIdsSnapshot.filter((id) => !resultIds.has(id));
  if (missing.length > 0) return err(`solver child omitted query results: ${missing.join(", ")}`);
  if (resultIds.size !== expectedIdsSnapshot.length) return err("solver query ids are not unique");
  const results = new Map<string, SolverChildResult>();
  for (const { item, id } of items) {
    const status = item.status;
    if (status !== "sat" && status !== "unsat" && status !== "unknown" && status !== "budget" && status !== "error")
      return err(`solver child returned an invalid status for query ${id}`);
    const budget: ValueBudget = { nodes: 0, totalText: 0 };
    let model: { [name: string]: string } | undefined;
    const rawModel = item.model;
    if (rawModel !== undefined) {
      if (!isObject(rawModel)) return err(`solver child returned an invalid model for query ${id}`);
      const copied = copyModel(rawModel, budget);
      if (!copied.ok) return err(`${copied.error} for query ${id}`);
      model = copied.value;
    }
    let core: string[] | undefined;
    const rawCore = item.core;
    if (rawCore !== undefined) {
      if (!Array.isArray(rawCore)) return err(`solver child returned an invalid core for query ${id}`);
      const copied = copyCore(rawCore, budget);
      if (!copied.ok) return err(`${copied.error} for query ${id}`);
      core = copied.value;
    }
    const rawError = item.error;
    if (rawError !== undefined) {
      if (typeof rawError !== "string") return err(`solver child returned an invalid error for query ${id}`);
      const error = consumeString(budget, "error", rawError);
      if (error !== null) return err(`${error} for query ${id}`);
    }
    results.set(id, {
      id,
      status,
      ...(model === undefined ? {} : { model }),
      ...(core === undefined ? {} : { core }),
      ...(rawError === undefined ? {} : { error: rawError }),
    });
  }
  return ok(results);
}
