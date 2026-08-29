// VerificationReport の直列化・契約適合・解体 — 形式（JSON）の知識はすべて
// ここに封じる。v1 キー順（backend, irVersion, irHash, method, [unavailable],
// findings, skipped, [crossChecked]）・`JSON.stringify(・, null, 2) + "\n"` の
// 描画・findings スキーマ自己検証・降格文言（golden 凍結）は本モジュールの
// 責務。conformToFindingsContract が「書き手は不適合ファイルを決して出さない」
// の実装（refcheck と同じ規律・同じ凍結文言）。

import type { Result } from "../../kernel/infrastructure/index.ts";
import { type Json, isObject } from "../../kernel/adapter/index.ts";
import { type Schema, validateSchema } from "../../kernel/adapter/index.ts";
import type { SchemaUnreadable } from "../../kernel/adapter/index.ts";
import {
  type CrossCheckedEntry,
  type VerificationFinding,
  type VerificationSkipped,
  VerificationReport,
  VerificationReportId,
} from "../domain/index.ts";

function orderedDocument(report: VerificationReport): { [k: string]: Json } {
  const ordered: { [k: string]: Json } = {
    backend: report.id().backendName(),
    irVersion: report.irVersion(),
    irHash: report.irHash(),
    method: report.method(),
  };
  const reason = report.unavailableReason();
  if (reason !== null) ordered.unavailable = { reason };
  ordered.findings = report.findings() as unknown as Json;
  ordered.skipped = report.skipped() as unknown as Json;
  const crossChecked = report.crossChecked();
  if (crossChecked !== null) ordered.crossChecked = crossChecked as unknown as Json;
  return ordered;
}

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderVerificationReportBytes(report: VerificationReport): string {
  return `${JSON.stringify(orderedDocument(report), null, 2)}\n`;
}

// 契約2 への適合を保証した集約を返す。スキーマ不可読・自己検証不適合は
// 降格（文言は凍結）。適合していれば元の集約をそのまま返す。
export function conformToFindingsContract(
  report: VerificationReport,
  findingsSchema: Result<Schema, SchemaUnreadable>,
): VerificationReport {
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

// 書かれた Json を型付き状態へ解いて集約を再構成する（findById 用の厳密形）。
export function parseVerificationReportDocument(
  id: VerificationReportId,
  raw: Json,
): Result<VerificationReport, { cause: string }> {
  if (!isObject(raw)) return { ok: false, error: { cause: "document is not a JSON object" } };
  if (raw.backend !== id.backendName()) {
    return { ok: false, error: { cause: `document backend "${String(raw.backend)}" does not match the id backend "${id.backendName()}"` } };
  }
  if (!Array.isArray(raw.findings) || !Array.isArray(raw.skipped)) {
    return { ok: false, error: { cause: "document lacks findings/skipped arrays" } };
  }
  return { ok: true, value: reconstituteFromRaw(id, raw) };
}

// クロスチェックの取得規則で使う寛容形——backend フィールドが欠けた文書は
// ファイル名から補う（旧 recomputeCrossCheck の読込と同値）。読めない形は
// null（呼び手が黙って除く）。
export function parseSiblingReportDocument(
  directory: string,
  fileName: string,
  raw: Json,
): VerificationReport | null {
  if (!isObject(raw)) return null;
  const backend = typeof raw.backend === "string" ? raw.backend : fileName.replace(/\.json$/, "");
  return reconstituteFromRaw(VerificationReportId.of(directory, backend), raw);
}

function reconstituteFromRaw(id: VerificationReportId, raw: { [k: string]: Json }): VerificationReport {
  const skipped = (Array.isArray(raw.skipped) ? raw.skipped : []).filter(
    (s): s is { [k: string]: Json } => isObject(s) && typeof s.target === "string",
  );
  return VerificationReport.reconstitute({
    id,
    irVersion: typeof raw.irVersion === "string" ? raw.irVersion : "",
    irHash: typeof raw.irHash === "string" ? raw.irHash : "",
    method: typeof raw.method === "string" ? raw.method : "",
    findings: (Array.isArray(raw.findings) ? raw.findings : []) as unknown as VerificationFinding[],
    skipped: skipped as unknown as VerificationSkipped[],
    crossChecked: Array.isArray(raw.crossChecked) ? (raw.crossChecked as unknown as CrossCheckedEntry[]) : null,
    unavailableReason: isObject(raw.unavailable)
      ? typeof raw.unavailable.reason === "string"
        ? raw.unavailable.reason
        : ""
      : null,
  });
}
