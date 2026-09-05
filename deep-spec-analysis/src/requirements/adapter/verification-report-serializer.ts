// 描画は JSON.stringify だけ。復号では形の不正を失敗として返し、
// 未知の語彙は逐語で保持する。契約適合の判断は集約と FindingsSchema が所有する。
import { BackendName, ContentHash, FrRefs, IrVersion, TargetIds, type ArtifactPath, TargetId } from "@deep-spec/kernel-domain";
import { type Json, type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { decodeFindingsDocument } from "@deep-spec/kernel-adapter";
import { VerificationReport, VerificationReportId, VerificationFinding, VerificationFindings, VerificationSkipped, VerificationSkips, VerificationWitness, CrossCheckedEntries, CrossCheckedEntry } from "@deep-spec/requirements-domain";

export function renderVerificationReportBytes(report: VerificationReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingReportDocument(directory: ArtifactPath, fileName: string, raw: Json): Result<VerificationReport, string> {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return err(decoded.error);
  const doc = decoded.value;
  if (`${doc.backend}.json` !== fileName) return err("backend must match the report filename");
  return ok(VerificationReport.reconstitute({
    id: VerificationReportId.of(directory, doc.backend),
    irVersion: IrVersion.reconstitute(doc.irVersion),
    irHash: ContentHash.reconstitute(doc.irHash),
    method: doc.method,
    findings: VerificationFindings.of(doc.findings.map((entry) => VerificationFinding.reconstitute({
      kind: entry.kind, frRefs: FrRefs.reconstitute(entry.frRefs), targets: TargetIds.reconstitute(entry.targets),
      witness: VerificationWitness.fromDocument(entry.witness), detail: entry.detail,
    }))),
    skipped: VerificationSkips.of(doc.skipped.map((entry) => VerificationSkipped.reconstitute({
      target: TargetId.reconstitute(entry.target), reason: entry.reason,
      ...(entry.detail !== undefined ? { detail: entry.detail } : {}),
    }))),
    crossChecked: doc.crossChecked === undefined ? null : CrossCheckedEntries.of(doc.crossChecked.map((entry) =>
      CrossCheckedEntry.reconstitute({ backend: BackendName.reconstitute(entry.backend), targets: TargetIds.reconstitute(entry.targets) }))),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
