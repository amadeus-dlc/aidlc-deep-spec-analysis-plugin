// DesignReport の直列化・契約適合・解体 — 形式（JSON）の知識はすべてここに
// 封じる。設計文書のキー順（backend, irVersion, irHash, method, [unavailable],
// [inputs], [checked], findings, skipped, [crossChecked]）・
// `JSON.stringify(・, null, 2) + "\n"` の描画・findings スキーマ自己検証・
// 降格文言（golden 凍結）は本モジュールの責務。

import type { Result } from "../../kernel/infrastructure/index.ts";
import { type Json, isObject } from "../../kernel/adapter/index.ts";
import { type Schema, validateSchema } from "../../kernel/adapter/index.ts";
import type { SchemaUnreadable } from "../../kernel/adapter/index.ts";
import {
  type DesignCrossCheckedEntry,
  type DesignFinding,
  type DesignInputEntry,
  type DesignSkipped,
  DesignReport,
  DesignReportId,
} from "../domain/index.ts";

function orderedDocument(report: DesignReport): { [k: string]: Json } {
  const ordered: { [k: string]: Json } = {
    backend: report.id().backendName(),
    irVersion: report.irVersion(),
    irHash: report.irHash(),
    method: report.method(),
  };
  const reason = report.unavailableReason();
  if (reason !== null) ordered.unavailable = { reason };
  const inputs = report.inputs();
  if (inputs !== null) ordered.inputs = inputs as unknown as Json;
  const checked = report.checked();
  if (checked !== null) ordered.checked = checked as unknown as Json;
  ordered.findings = report.findings() as unknown as Json;
  ordered.skipped = report.skipped() as unknown as Json;
  const crossChecked = report.crossChecked();
  if (crossChecked !== null) ordered.crossChecked = crossChecked as unknown as Json;
  return ordered;
}

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderDesignReportBytes(report: DesignReport): string {
  return `${JSON.stringify(orderedDocument(report), null, 2)}\n`;
}

// 契約2 への適合を保証した集約を返す。スキーマ不可読・自己検証不適合は降格
// （文言は凍結）。適合していれば元の集約をそのまま返す。
export function conformDesignReport(
  report: DesignReport,
  findingsSchema: Result<Schema, SchemaUnreadable>,
): DesignReport {
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

// クロスチェックの取得規則で使う寛容形——backend フィールドが欠けた文書は
// ファイル名から補う（旧 recomputeDesignCrossCheck の読込と同値）。読めない形
// は null（呼び手が黙って除く）。findings は isObject 選別（旧同）。
export function parseSiblingDesignReportDocument(
  directory: string,
  fileName: string,
  raw: Json,
): DesignReport | null {
  if (!isObject(raw)) return null;
  const backend = typeof raw.backend === "string" ? raw.backend : fileName.replace(/\.json$/, "");
  const skipped = (Array.isArray(raw.skipped) ? raw.skipped : []).filter(
    (s): s is { [k: string]: Json } => isObject(s) && typeof s.target === "string",
  );
  return DesignReport.reconstitute({
    id: DesignReportId.of(directory, backend),
    irVersion: typeof raw.irVersion === "string" ? raw.irVersion : "",
    irHash: typeof raw.irHash === "string" ? raw.irHash : "",
    method: typeof raw.method === "string" ? raw.method : "",
    findings: (Array.isArray(raw.findings) ? raw.findings.filter(isObject) : []) as unknown as DesignFinding[],
    skipped: skipped as unknown as DesignSkipped[],
    inputs: Array.isArray(raw.inputs) ? (raw.inputs as unknown as DesignInputEntry[]) : null,
    checked: Array.isArray(raw.checked) ? (raw.checked as Json[]).filter((c): c is string => typeof c === "string") : null,
    crossChecked: Array.isArray(raw.crossChecked) ? (raw.crossChecked as unknown as DesignCrossCheckedEntry[]) : null,
    unavailableReason: isObject(raw.unavailable)
      ? typeof raw.unavailable.reason === "string"
        ? raw.unavailable.reason
        : ""
      : null,
  });
}
