// 描画は JSON.stringify だけ。復号では形の不正を失敗として返し、
// 未知の語彙は逐語で保持する。契約適合の判断は集約と FindingsSchema が所有する。
import { BackendName, ContentHash, FrRefs, IrVersion, TargetIds, type ArtifactPath, TargetId } from "@deep-spec/kernel-domain";
import { type Json, type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { decodeFindingsDocument } from "@deep-spec/kernel-adapter";
import { DesignReport, DesignReportId, DesignFinding, DesignFindings, DesignSkipped, DesignSkips, DesignWitness, DesignCrossCheckedEntries, DesignCrossCheckedEntry, DesignInputAnchors, DesignInputAnchor, CheckedUnits } from "@deep-spec/design-domain";

export function renderDesignReportBytes(report: DesignReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingDesignReportDocument(directory: ArtifactPath, fileName: string, raw: Json): Result<DesignReport, string> {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return err(decoded.error);
  const doc = decoded.value;
  if (`${doc.backend}.json` !== fileName) return err("backend must match the report filename");
  return ok(DesignReport.reconstitute({
    id: DesignReportId.of(directory, doc.backend),
    irVersion: IrVersion.reconstitute(doc.irVersion),
    irHash: ContentHash.reconstitute(doc.irHash),
    method: doc.method,
    findings: DesignFindings.of(doc.findings.map((entry) => DesignFinding.reconstitute({
      kind: entry.kind, frRefs: FrRefs.reconstitute(entry.frRefs), targets: TargetIds.reconstitute(entry.targets),
      witness: DesignWitness.fromDocument(entry.witness), detail: entry.detail, unit: entry.unit ?? "",
    }))),
    skipped: DesignSkips.of(doc.skipped.map((entry) => DesignSkipped.reconstitute({
      target: TargetId.reconstitute(entry.target), reason: entry.reason, unit: entry.unit ?? "",
      ...(entry.detail !== undefined ? { detail: entry.detail } : {}),
    }))),
    inputs: doc.inputs === undefined ? null : DesignInputAnchors.of(doc.inputs.map((entry) =>
      DesignInputAnchor.reconstitute({ artifact: entry.artifact, sha256: ContentHash.reconstitute(entry.sha256) }))),
    checked: doc.checked === undefined ? null : CheckedUnits.reconstitute(doc.checked),
    crossChecked: doc.crossChecked === undefined ? null : DesignCrossCheckedEntries.of(doc.crossChecked.map((entry) =>
      DesignCrossCheckedEntry.reconstitute({ backend: BackendName.reconstitute(entry.backend), targets: TargetIds.reconstitute(entry.targets) }))),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
