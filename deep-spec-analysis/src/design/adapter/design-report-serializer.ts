// DesignReport の描画と解体 — 形式（JSON）の走査はここに封じる。文書のキー順は
// 契約2 の知識なので集約が `toDocument()` で所有し、本モジュールが持つのは
// `JSON.stringify(・, null, 2) + "\n"` の描画（golden 凍結）と、書かれた文書を
// 集約へ戻す寛容な解体だけ。契約適合（自己検証と降格文言）は値オブジェクト
// FindingsSchema と集約の `conformedTo` が持つ。

import { BackendName, ContentHash, FrRefs, IrVersion, TargetIds, type ArtifactPath, TargetId } from "@deep-spec/kernel-domain";
import { type Json, isObject } from "@deep-spec/kernel-infrastructure";
import {
  CheckedUnits,
  DesignWitness,
  DesignCrossCheckedEntries,
  DesignFinding,
  DesignFindings,
  DesignInputAnchors,
  DesignSkips,
  DesignSkipped,
  DesignReport,
  DesignReportId,
  DesignInputAnchor,
  DesignCrossCheckedEntry,
} from "@deep-spec/design-domain";

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderDesignReportBytes(report: DesignReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
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
          frRefs: FrRefs.reconstitute(Array.isArray(entry.frRefs) ? (entry.frRefs.filter((x) => typeof x === "string") as string[]) : []),
          targets: TargetIds.reconstitute(Array.isArray(entry.targets) ? (entry.targets.filter((x) => typeof x === "string") as string[]) : []),
          witness: DesignWitness.fromDocument(entry.witness ?? null),
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
          return DesignInputAnchor.reconstitute({
            artifact: typeof entry.artifact === "string" ? entry.artifact : "",
            sha256: ContentHash.reconstitute(typeof entry.sha256 === "string" ? entry.sha256 : ""),
          });
        }))
      : null,
    checked: Array.isArray(raw.checked) ? CheckedUnits.reconstitute((raw.checked as Json[]).filter((c): c is string => typeof c === "string")) : null,
    crossChecked: Array.isArray(raw.crossChecked) ? DesignCrossCheckedEntries.of(
          (raw.crossChecked as Json[]).filter(isObject).map((e) => DesignCrossCheckedEntry.reconstitute({
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
