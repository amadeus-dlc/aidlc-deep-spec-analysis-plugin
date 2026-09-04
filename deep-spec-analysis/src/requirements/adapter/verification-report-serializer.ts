// VerificationReport の描画と解体 — 形式（JSON）の走査はここに封じる。文書の
// キー順は契約2 の知識なので集約が `toDocument()` で所有し、本モジュールが持つ
// のは `JSON.stringify(・, null, 2) + "\n"` の描画（golden 凍結）と、書かれた
// 文書を集約へ戻す寛容な解体だけ。契約適合（自己検証と降格文言）は値オブジェ
// クト FindingsSchema と集約の `conformedTo` が持つ。

import { BackendName, ContentHash, FrRefs, IrVersion, TargetId, TargetIds, type ArtifactPath } from "@deep-spec/kernel-domain";
import { type Json, isObject } from "@deep-spec/kernel-infrastructure";
import {
  CrossCheckedEntries,
  VerificationFindings,
  VerificationSkips,
  VerificationSkipped,
  VerificationWitness,
  VerificationReport,
  VerificationReportId,
  VerificationFinding,
  CrossCheckedEntry,
} from "@deep-spec/requirements-domain";

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderVerificationReportBytes(report: VerificationReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
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
        return VerificationFinding.reconstitute({
          kind: typeof entry.kind === "string" ? entry.kind : "",
          frRefs: FrRefs.reconstitute(Array.isArray(entry.frRefs) ? (entry.frRefs.filter((x) => typeof x === "string") as string[]) : []),
          targets: TargetIds.reconstitute(Array.isArray(entry.targets) ? (entry.targets.filter((x) => typeof x === "string") as string[]) : []),
          witness: VerificationWitness.fromDocument(entry.witness),
          detail: typeof entry.detail === "string" ? entry.detail : "",
        });
      }),
    ),
    skipped: VerificationSkips.of(
      skipped.map((entry) => {
        return VerificationSkipped.reconstitute({
          target: TargetId.reconstitute(typeof entry.target === "string" ? entry.target : ""),
          reason: typeof entry.reason === "string" ? entry.reason : "",
          ...(typeof entry.detail === "string" ? { detail: entry.detail } : {}),
        });
      }),
    ),
    crossChecked: Array.isArray(raw.crossChecked)
      ? CrossCheckedEntries.of(
          (raw.crossChecked as Json[]).filter(isObject).map((e) => CrossCheckedEntry.reconstitute({
            backend: BackendName.reconstitute(typeof e.backend === "string" ? e.backend : ""),
            targets: TargetIds.reconstitute(Array.isArray(e.targets) ? (e.targets.filter((t) => typeof t === "string") as string[]) : []),
          })),
        )
      : null,
    unavailableReason: isObject(raw.unavailable)
      ? typeof raw.unavailable.reason === "string"
        ? raw.unavailable.reason
        : ""
      : null,
  });
}
