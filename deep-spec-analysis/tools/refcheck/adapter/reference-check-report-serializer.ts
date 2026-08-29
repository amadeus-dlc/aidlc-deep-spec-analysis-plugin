// ReferenceCheckReport の直列化・契約適合・解体 — 形式（JSON）の知識は
// すべてここに封じる。正準キー順・irHash（inputs の正準 JSON の sha256）・
// `JSON.stringify(・, null, 2) + "\n"` の描画・findings スキーマ自己検証・
// 降格文言（golden 凍結）は本モジュールの責務。
//
// conformToContract が「書き手は不適合ファイルを決して出さない」の実装：
// 直列化形をスキーマ検証し、不適合なら降格した集約を返す。verdict は
// この戻り値から導出させることで、stdout とファイルの矛盾を構造的に防ぐ。

import { type Result, sha256 } from "../../kernel/domain/index.ts";
import { canonicalStringify } from "../../kernel/adapter/canonical-json.ts";
import { type Json, isObject } from "../../kernel/adapter/json-value.ts";
import { type Schema, validateSchema } from "../../kernel/adapter/schema-validator.ts";
import type { SchemaUnreadable } from "../../kernel/adapter/contract-schema.ts";
import {
  CATALOG_VERSION,
  type Finding,
  type InputEntry,
  ReferenceCheckReport,
  type ReferenceCheckReportId,
  type Skipped,
} from "../domain/index.ts";

function orderedDocument(report: ReferenceCheckReport): { [k: string]: Json } {
  const inputs = report.inputs() as unknown as Json;
  const ordered: { [k: string]: Json } = {
    backend: report.id().backendName(),
    irVersion: CATALOG_VERSION,
    irHash: sha256(canonicalStringify(inputs)),
    method: "static",
  };
  const reason = report.unavailableReason();
  if (reason !== null) ordered.unavailable = { reason };
  ordered.inputs = inputs;
  ordered.checked = report.checked() as unknown as Json;
  ordered.findings = report.findings() as unknown as Json;
  ordered.skipped = report.skipped() as unknown as Json;
  return ordered;
}

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderReportBytes(report: ReferenceCheckReport): string {
  return `${JSON.stringify(orderedDocument(report), null, 2)}\n`;
}

// 契約2 への適合を保証した集約を返す。スキーマ不可読・自己検証不適合は
// 降格（文言は凍結）。適合していれば元の集約をそのまま返す。
export function conformToContract(
  report: ReferenceCheckReport,
  findingsSchema: Result<Schema, SchemaUnreadable>,
): ReferenceCheckReport {
  if (!findingsSchema.ok) {
    return report.degraded(`findings schema unreadable: ${findingsSchema.error.cause}`);
  }
  const errors: string[] = [];
  validateSchema(findingsSchema.value, findingsSchema.value, orderedDocument(report) as Json, "", errors);
  if (errors.length > 0) {
    return report.degraded(`self-validation against deep-spec-findings-schema.json failed: ${errors[0]}`);
  }
  return report;
}

// 書かれた Json を型付き状態へ解いて集約を再構成する。集約として成立しない
// 形は材料つきで拒否する（Repository が corrupt に写す）。
export function parseReportDocument(
  id: ReferenceCheckReportId,
  raw: Json,
): Result<ReferenceCheckReport, { cause: string }> {
  if (!isObject(raw)) return { ok: false, error: { cause: "document is not a JSON object" } };
  if (raw.backend !== id.backendName()) {
    return { ok: false, error: { cause: `document backend "${String(raw.backend)}" does not match the id backend "${id.backendName()}"` } };
  }
  if (!Array.isArray(raw.findings) || !Array.isArray(raw.skipped) || !Array.isArray(raw.inputs) || !Array.isArray(raw.checked)) {
    return { ok: false, error: { cause: "document lacks inputs/checked/findings/skipped arrays" } };
  }
  const unavailable = isObject(raw.unavailable) && typeof raw.unavailable.reason === "string" ? raw.unavailable.reason : null;
  return {
    ok: true,
    value: ReferenceCheckReport.reconstitute({
      id,
      inputs: raw.inputs as unknown as InputEntry[],
      checked: (raw.checked as Json[]).filter((c): c is string => typeof c === "string"),
      findings: raw.findings as unknown as Finding[],
      skipped: raw.skipped as unknown as Skipped[],
      unavailableReason: unavailable,
    }),
  };
}
