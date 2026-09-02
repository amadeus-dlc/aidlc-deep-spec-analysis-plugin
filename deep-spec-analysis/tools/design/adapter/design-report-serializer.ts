// DesignReport の直列化・契約適合・解体 — 形式（JSON）の知識はすべてここに
// 封じる。設計文書のキー順（backend, irVersion, irHash, method, [unavailable],
// [inputs], [checked], findings, skipped, [crossChecked]）・
// `JSON.stringify(・, null, 2) + "\n"` の描画・findings スキーマ自己検証・
// 降格文言（golden 凍結）は本モジュールの責務。

import { BackendName, ContentHash, FrRefs, IrVersion, TargetIds, type ArtifactPath, TargetId } from "../../kernel/domain/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { type Json, isObject } from "../../kernel/adapter/index.ts";
import { type Schema, validateSchema } from "../../kernel/adapter/index.ts";
import type { SchemaUnreadable } from "../../kernel/adapter/index.ts";
import {
  CheckedUnits,
  DesignCrossCheckedEntries,
  DesignFinding,
  DesignFindings,
  DesignInputAnchors,
  DesignSkips,
  DesignSkipped,
  type DesignValue,
  DesignReport,
  DesignReportId,
} from "../domain/index.ts";

function orderedDocument(report: DesignReport): { [k: string]: Json } {
  const ordered: { [k: string]: Json } = {
    backend: report.id().backendName().asString(),
    irVersion: report.irVersion().asString(),
    irHash: report.irHash().asString(),
    method: report.method(),
  };
  const reason = report.unavailableReason();
  if (reason !== null) ordered.unavailable = { reason };
  const inputs = report.inputs();
  // ContentHash は境界（描画）で asString() へ落とす（キー順は旧挿入順）。
  if (inputs !== null) ordered.inputs = inputs.toArray().map((i) => ({ artifact: i.artifact, sha256: i.sha256.asString() })) as unknown as Json;
  const checked = report.checked();
  if (checked !== null) ordered.checked = checked.toArray() as unknown as Json;
  // ペイロードのコレクションはこの描画点でだけ toArray() に降りる。キー順は
  // 旧構築サイトの挿入順そのもの（golden バイト凍結）：finding は (kind,
  // frRefs, targets, witness, unit, detail)、skip は (target, reason, unit,
  // detail?)。witness は remap 素通し値（DesignValue）で逐語描画。
  ordered.findings = report.findings().toArray().map((f) => {
    const out: { [k: string]: Json } = {
      kind: f.kind(),
      frRefs: f.frRefs().toArray() as unknown as Json,
      targets: f.targets().toStrings() as unknown as Json,
      witness: f.witness() as unknown as Json,
      unit: f.unit(),
      detail: f.detail(),
    };
    return out as Json;
  });
  ordered.skipped = report.skipped().toArray().map((sk) => {
    const out: { [k: string]: Json } = { target: sk.target().asString(), reason: sk.reason(), unit: sk.unit() };
    const detail = sk.detail();
    if (detail !== undefined) out.detail = detail;
    return out as Json;
  });
  const crossChecked = report.crossChecked();
  // crossChecked エントリの凍結キー順は (backend, targets)。
  if (crossChecked !== null) {
    ordered.crossChecked = crossChecked.toArray().map((e) => ({ backend: e.backend.asString(), targets: e.targets.toStrings() }) as unknown as Json);
  }
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
  directory: ArtifactPath,
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
    irVersion: IrVersion.reconstitute(typeof raw.irVersion === "string" ? raw.irVersion : ""),
    irHash: ContentHash.reconstitute(typeof raw.irHash === "string" ? raw.irHash : ""),
    method: typeof raw.method === "string" ? raw.method : "",
    findings: DesignFindings.of(
      (Array.isArray(raw.findings) ? raw.findings.filter(isObject) : []).map((e) => {
        const entry = e as { [k: string]: Json };
        return DesignFinding.reconstitute({
          kind: typeof entry.kind === "string" ? entry.kind : "",
          frRefs: FrRefs.of(Array.isArray(entry.frRefs) ? (entry.frRefs.filter((x) => typeof x === "string") as string[]) : []),
          targets: TargetIds.reconstitute(Array.isArray(entry.targets) ? (entry.targets.filter((x) => typeof x === "string") as string[]) : []),
          witness: (entry.witness ?? null) as unknown as DesignValue,
          unit: typeof entry.unit === "string" ? entry.unit : "",
          detail: typeof entry.detail === "string" ? entry.detail : "",
        });
      }),
    ),
    skipped: DesignSkips.of(
      skipped.map((entry) => {
        return DesignSkipped.reconstitute({
          target: TargetId.reconstitute(typeof entry.target === "string" ? entry.target : ""),
          reason: typeof entry.reason === "string" ? entry.reason : "",
          unit: typeof entry.unit === "string" ? entry.unit : "",
          ...(typeof entry.detail === "string" ? { detail: entry.detail } : {}),
        });
      }),
    ),
    inputs: Array.isArray(raw.inputs)
      ? DesignInputAnchors.of((raw.inputs as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          return {
            artifact: typeof entry.artifact === "string" ? entry.artifact : "",
            sha256: ContentHash.reconstitute(typeof entry.sha256 === "string" ? entry.sha256 : ""),
          };
        }))
      : null,
    checked: Array.isArray(raw.checked) ? CheckedUnits.of((raw.checked as Json[]).filter((c): c is string => typeof c === "string")) : null,
    crossChecked: Array.isArray(raw.crossChecked) ? DesignCrossCheckedEntries.of(
          (raw.crossChecked as Json[]).filter(isObject).map((e) => ({
            backend: BackendName.reconstitute(typeof e.backend === "string" ? e.backend : ""),
            targets: TargetIds.reconstitute(Array.isArray(e.targets) ? (e.targets.filter((t) => typeof t === "string") as string[]) : []),
          })),
        ) : null,
    unavailableReason: isObject(raw.unavailable)
      ? typeof raw.unavailable.reason === "string"
        ? raw.unavailable.reason
        : ""
      : null,
  });
}
