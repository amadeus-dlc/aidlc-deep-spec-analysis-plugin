// VerificationReport の直列化・契約適合・解体 — 形式（JSON）の知識はすべて
// ここに封じる。v1 キー順（backend, irVersion, irHash, method, [unavailable],
// findings, skipped, [crossChecked]）・`JSON.stringify(・, null, 2) + "\n"` の
// 描画・findings スキーマ自己検証・降格文言（golden 凍結）は本モジュールの
// 責務。conformToFindingsContract が「書き手は不適合ファイルを決して出さない」
// の実装（refcheck と同じ規律・同じ凍結文言）。

import { ContentHash, FrRefs, IrVersion, TargetIds, type ArtifactPath } from "../../kernel/domain/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { type Json, isObject } from "../../kernel/adapter/index.ts";
import { type Schema, validateSchema } from "../../kernel/adapter/index.ts";
import type { SchemaUnreadable } from "../../kernel/adapter/index.ts";
import {
  CrossCheckedEntries,
  VerificationFindings,
  VerificationSkips,
  type CrossCheckedEntry,
  type VerificationSkipped,
  type VerificationWitness,
  VerificationReport,
  VerificationReportId,
} from "../domain/index.ts";

function orderedDocument(report: VerificationReport): { [k: string]: Json } {
  const ordered: { [k: string]: Json } = {
    backend: report.id().backendName(),
    irVersion: report.irVersion().asString(),
    irHash: report.irHash().asString(),
    method: report.method(),
  };
  const reason = report.unavailableReason();
  if (reason !== null) ordered.unavailable = { reason };
  // コレクションは境界（描画）で toArray() へ落とす——中身は契約2 の素の JSON 形。
  // ペイロードのコレクションはこの描画点でだけ toArray() に降りる。キー順は
  // 旧構築サイトの挿入順そのもの（golden バイト凍結）：finding は (kind,
  // frRefs, targets, witness, detail)、skip は (target, reason, detail?)。
  // witness ユニオンの内側は素通し値（材料）で逐語描画。
  ordered.findings = report.findings().toArray().map((f) => {
    const out: { [k: string]: Json } = {
      kind: f.kind,
      frRefs: f.frRefs.toArray() as unknown as Json,
      targets: f.targets.toArray() as unknown as Json,
      witness: f.witness as unknown as Json,
      detail: f.detail,
    };
    return out as Json;
  });
  ordered.skipped = report.skipped().toArray().map((sk) => {
    const out: { [k: string]: Json } = { target: sk.target, reason: sk.reason };
    if (sk.detail !== undefined) out.detail = sk.detail;
    return out as Json;
  });
  const crossChecked = report.crossChecked();
  if (crossChecked !== null) ordered.crossChecked = crossChecked.toArray() as unknown as Json;
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
  directory: ArtifactPath,
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
    irVersion: IrVersion.reconstitute(typeof raw.irVersion === "string" ? raw.irVersion : ""),
    irHash: ContentHash.reconstitute(typeof raw.irHash === "string" ? raw.irHash : ""),
    method: typeof raw.method === "string" ? raw.method : "",
    findings: VerificationFindings.of(
      (Array.isArray(raw.findings) ? raw.findings.filter(isObject) : []).map((e) => {
        const entry = e as { [k: string]: Json };
        return {
          kind: typeof entry.kind === "string" ? entry.kind : "",
          frRefs: FrRefs.of(Array.isArray(entry.frRefs) ? (entry.frRefs.filter((x) => typeof x === "string") as string[]) : []),
          targets: TargetIds.of(Array.isArray(entry.targets) ? (entry.targets.filter((x) => typeof x === "string") as string[]) : []),
          witness: (entry.witness ?? { core: [] }) as unknown as VerificationWitness,
          detail: typeof entry.detail === "string" ? entry.detail : "",
        };
      }),
    ),
    skipped: VerificationSkips.of(
      skipped.map((entry) => {
        const sk: VerificationSkipped = {
          target: typeof entry.target === "string" ? entry.target : "",
          reason: typeof entry.reason === "string" ? entry.reason : "",
        };
        if (typeof entry.detail === "string") sk.detail = entry.detail;
        return sk;
      }),
    ),
    crossChecked: Array.isArray(raw.crossChecked)
      ? CrossCheckedEntries.of(raw.crossChecked as unknown as CrossCheckedEntry[])
      : null,
    unavailableReason: isObject(raw.unavailable)
      ? typeof raw.unavailable.reason === "string"
        ? raw.unavailable.reason
        : ""
      : null,
  });
}
