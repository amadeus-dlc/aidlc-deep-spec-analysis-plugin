import { UnitName, SkipReason, TargetId, FindingKind, RequirementId, ContentHash, FrRefs, TargetIds } from "@deep-spec/kernel-domain";

import { decodeDomainValues } from "@deep-spec/kernel-adapter";

// ReferenceCheckReport の描画と解体 — 形式（JSON）の走査はここに封じる。文書の
// キー順は契約2 の知識なので集約が `toDocument()` で所有し、本モジュールが
// 持つのは `JSON.stringify(・, null, 2) + "\n"` の描画（golden 凍結）と、書か
// れた文書を集約へ戻す寛容な解体だけ（design の serializer と同じ分担、
// PR2b 改訂）。契約適合（自己検証と降格文言）は値オブジェクト FindingsSchema
// と集約の `conformedTo` が持つ。

import type { Result } from "@deep-spec/kernel-infrastructure";
import { type Json, isObject } from "@deep-spec/kernel-infrastructure";

import {
  Finding,
  Skipped,
  WitnessRef,
  Findings,
  InputAnchors,
  ReferenceCheckReport,
  type ReferenceCheckReportId,
  Skips,
  WitnessRefs,
  InputAnchor,
} from "@deep-spec/refcheck-domain";

// 境界: 永続化される正確なバイト列（golden 凍結の描画形式）。
export function renderReportBytes(report: ReferenceCheckReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

// 書かれた Json を型付き状態へ解いて集約を再構成する。集約として成立しない
// 形は材料つきで拒否する（Repository が corrupt に写す）。
export function parseReportDocument(id: ReferenceCheckReportId, raw: Json): ReturnType<typeof parseReportDocumentValue> {
  const decoded = decodeDomainValues(() => parseReportDocumentValue(id, raw));
  return decoded.ok ? decoded.value : { ok: false, error: { cause: decoded.error } };
}

function parseReportDocumentValue(
  id: ReferenceCheckReportId,
  raw: Json,
): Result<ReferenceCheckReport, { cause: string }> {
  if (!isObject(raw)) return { ok: false, error: { cause: "document is not a JSON object" } };
  if (raw.backend !== id.backendName().asString()) {
    return { ok: false, error: { cause: `document backend "${String(raw.backend)}" does not match the id backend "${id.backendName().asString()}"` } };
  }
  if (!Array.isArray(raw.findings) || !Array.isArray(raw.skipped) || !Array.isArray(raw.inputs) || !Array.isArray(raw.checked)) {
    return { ok: false, error: { cause: "document lacks inputs/checked/findings/skipped arrays" } };
  }
  const unavailable = isObject(raw.unavailable) && typeof raw.unavailable.reason === "string" ? raw.unavailable.reason : null;
  return {
    ok: true,
    value: ReferenceCheckReport.of({
      id,
      inputs: InputAnchors.of(
        (raw.inputs as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          return InputAnchor.of({
            artifact: typeof entry.artifact === "string" ? entry.artifact : "",
            sha256: ContentHash.of(typeof entry.sha256 === "string" ? entry.sha256 : ""),
          });
        }),
      ),
      checked: TargetIds.of(Array.from((raw.checked as Json[]).filter((c): c is string => typeof c === "string"), (raw) => TargetId.of(raw))),
      findings: Findings.of(
        (raw.findings as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          const witness = isObject(entry.witness) ? entry.witness : {};
          const refs = Array.isArray(witness.refs)
            ? witness.refs.map((r) => {
                const rr = isObject(r) ? r : {};
                return WitnessRef.of({
                  artifact: typeof rr.artifact === "string" ? rr.artifact : "",
                  element: typeof rr.element === "string" ? rr.element : "",
                  ...(typeof rr.value === "string" ? { value: rr.value } : {}),
                });
              })
            : [];
          return Finding.of({
            kind: FindingKind.of(typeof entry.kind === "string" ? entry.kind : ""),
            frRefs: FrRefs.of(Array.from(Array.isArray(entry.frRefs) ? (entry.frRefs.filter((x) => typeof x === "string") as string[]) : [], (raw) => RequirementId.of(raw))),
            targets: TargetIds.of(Array.from(Array.isArray(entry.targets) ? (entry.targets.filter((x) => typeof x === "string") as string[]) : [], (raw) => TargetId.of(raw))),
            witness: { refs: WitnessRefs.of(refs) },
            detail: typeof entry.detail === "string" ? entry.detail : "",
            ...(typeof entry.unit === "string" ? { unit: UnitName.of(entry.unit)} : {}),
          });
        }),
      ),
      skipped: Skips.of(
        (raw.skipped as Json[]).map((e) => {
          const entry = isObject(e) ? e : {};
          return Skipped.of({
            target: TargetId.of(typeof entry.target === "string" ? entry.target : ""),
            reason: SkipReason.of(typeof entry.reason === "string" ? entry.reason : ""),
            ...(typeof entry.detail === "string" ? { detail: entry.detail } : {}),
            ...(typeof entry.unit === "string" ? { unit: UnitName.of(entry.unit)} : {}),
          });
        }),
      ),
      unavailableReason: unavailable,
    }),
  };
}
