import {
  VerificationMethod,
  RequirementId,
  UnitName,
  SkipReason,
  FindingKind,
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
// 未知の語彙は逐語で保持する。契約適合の判断は集約と FindingsSchema が所有する。

import { type Json, type Result, err, ok } from "@deep-spec/kernel-infrastructure";

import { DesignReport, DesignReportId, DesignFinding, DesignFindings, DesignSkipped, DesignSkips, DesignWitness, DesignCrossCheckedEntries, DesignCrossCheckedEntry, DesignInputAnchors, DesignInputAnchor, CheckedUnits } from "@deep-spec/design-domain";

export function renderDesignReportBytes(report: DesignReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingDesignReportDocument(directory: ArtifactPath, fileName: string, raw: Json): ReturnType<typeof parseSiblingDesignReportDocumentValue> {
  const decoded = decodeDomainValues(() => parseSiblingDesignReportDocumentValue(directory, fileName, raw));
  return decoded.ok ? decoded.value : err(decoded.error);
}

function parseSiblingDesignReportDocumentValue(directory: ArtifactPath, fileName: string, raw: Json): Result<DesignReport, string> {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return err(decoded.error);
  const doc = decoded.value;
  if (`${doc.backend}.json` !== fileName) return err("backend must match the report filename");
  return ok(DesignReport.of({
    id: DesignReportId.of(directory, doc.backend),
    irVersion: IrVersion.of(doc.irVersion),
    irHash: ContentHash.of(doc.irHash),
    method: VerificationMethod.of(doc.method),
    findings: DesignFindings.of(doc.findings.map((entry) => DesignFinding.of({
      kind: FindingKind.of(entry.kind), frRefs: FrRefs.of(Array.from(entry.frRefs, (raw) => RequirementId.of(raw))), targets: TargetIds.of(Array.from(entry.targets, (raw) => TargetId.of(raw))),
      witness: DesignWitness.of(entry.witness), detail: entry.detail, unit: UnitName.of(entry.unit ?? ""),
    }))),
    skipped: DesignSkips.of(doc.skipped.map((entry) => DesignSkipped.of({
      target: TargetId.of(entry.target), reason: SkipReason.of(entry.reason), unit: UnitName.of(entry.unit ?? ""),
      ...(entry.detail !== undefined ? { detail: entry.detail } : {}),
    }))),
    inputs: doc.inputs === undefined ? null : DesignInputAnchors.of(doc.inputs.map((entry) =>
      DesignInputAnchor.of({ artifact: entry.artifact, sha256: ContentHash.of(entry.sha256) }))),
    checked: doc.checked === undefined ? null : CheckedUnits.of(Array.from(doc.checked, (raw) => UnitName.of(raw))),
    crossChecked: doc.crossChecked === undefined ? null : DesignCrossCheckedEntries.of(doc.crossChecked.map((entry) =>
      DesignCrossCheckedEntry.of({ backend: BackendName.of(entry.backend), targets: TargetIds.of(Array.from(entry.targets, (raw) => TargetId.of(raw))) }))),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
