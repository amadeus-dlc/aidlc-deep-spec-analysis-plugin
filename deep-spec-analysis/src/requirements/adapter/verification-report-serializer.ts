import {
  VerificationMethod,
  SkipReason,
  FindingKind,
  RequirementId,
  BackendName,
  ContentHash,
  FrRefs,
  IrVersion,
  TargetIds,
  type ArtifactPath,
  TargetId,
} from "@deep-spec/kernel-domain";

import { decodeDomainValues, decodeFindingsDocument } from "@deep-spec/kernel-adapter";

// 描画は JSON.stringify だけ。復号では形の不正を失敗として返し、
// 語彙の契約違反は復号失敗に変換する。契約適合の判断は集約と FindingsSchema が所有する。

import { type Json, type Result, err, ok } from "@deep-spec/kernel-infrastructure";

import { VerificationReport, VerificationReportId, VerificationFinding, VerificationFindings, VerificationSkipped, VerificationSkips, VerificationWitness, CrossCheckedEntries, CrossCheckedEntry } from "@deep-spec/requirements-domain";

export function renderVerificationReportBytes(report: VerificationReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingReportDocument(directory: ArtifactPath, fileName: string, raw: Json): ReturnType<typeof parseSiblingReportDocumentValue> {
  const decoded = decodeDomainValues(() => parseSiblingReportDocumentValue(directory, fileName, raw));
  return decoded.ok ? decoded.value : err(decoded.error);
}

function parseSiblingReportDocumentValue(directory: ArtifactPath, fileName: string, raw: Json): Result<VerificationReport, string> {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return err(decoded.error);
  const doc = decoded.value;
  if (`${doc.backend}.json` !== fileName) return err("backend must match the report filename");
  return ok(VerificationReport.of({
    id: VerificationReportId.of(directory, doc.backend),
    irVersion: IrVersion.of(doc.irVersion),
    irHash: ContentHash.of(doc.irHash),
    method: VerificationMethod.of(doc.method),
    findings: VerificationFindings.of(doc.findings.map((entry) => VerificationFinding.of({
      kind: FindingKind.of(entry.kind), frRefs: FrRefs.of(Array.from(entry.frRefs, (raw) => RequirementId.of(raw))), targets: TargetIds.of(Array.from(entry.targets, (raw) => TargetId.of(raw))),
      witness: VerificationWitness.of(entry.witness as Parameters<typeof VerificationWitness.of>[0]), detail: entry.detail,
    }))),
    skipped: VerificationSkips.of(doc.skipped.map((entry) => VerificationSkipped.of({
      target: TargetId.of(entry.target), reason: SkipReason.of(entry.reason),
      ...(entry.detail !== undefined ? { detail: entry.detail } : {}),
    }))),
    crossChecked: doc.crossChecked === undefined ? null : CrossCheckedEntries.of(doc.crossChecked.map((entry) =>
      CrossCheckedEntry.of({ backend: BackendName.of(entry.backend), targets: TargetIds.of(Array.from(entry.targets, (raw) => TargetId.of(raw))) }))),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
