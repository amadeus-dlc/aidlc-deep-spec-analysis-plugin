import { type ArtifactPath, UnitName } from "@deep-spec/kernel-domain";
import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import { type Json, type Result, traverseResult, err, ok } from "@deep-spec/kernel-infrastructure";
import {
  DesignReport, DesignReportId, DesignFinding, DesignFindings, DesignSkipped, DesignSkips,
  DesignWitness, DesignCrossCheckedEntries, DesignCrossCheckedEntry, DesignInputAnchors, DesignInputAnchor, CheckedUnits,
} from "@deep-spec/design-domain";

export function renderDesignReportBytes(report: DesignReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingDesignReportDocument(directory: ArtifactPath, fileName: string, raw: Json): Result<DesignReport, string> {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return decoded;
  const doc = decoded.value;
  if (`${doc.backend.asString()}.json` !== fileName) return err("backend must match the report filename");
  const findings: DesignFinding[] = [];
  for (const entry of doc.findings) {
    if (entry.unit === undefined) return err("design finding requires a unit");
    findings.push(DesignFinding.of({ ...entry, unit: entry.unit, witness: DesignWitness.of(entry.witness) }));
  }
  const skipped: DesignSkipped[] = [];
  for (const entry of doc.skipped) {
    if (entry.unit === undefined) return err("design skip requires a unit");
    skipped.push(DesignSkipped.of({ ...entry, unit: entry.unit }));
  }
  const checked = doc.checked === undefined ? ok(undefined) : traverseResult(doc.checked, UnitName.parse);
  if (!checked.ok) return err(JSON.stringify(checked.error));
  return ok(DesignReport.of({
    id: DesignReportId.of(directory, doc.backend.asString()),
    irVersion: doc.irVersion, irHash: doc.irHash, method: doc.method,
    findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped),
    inputs: doc.inputs === undefined ? null : DesignInputAnchors.of(doc.inputs.map((entry) =>
      DesignInputAnchor.of({ artifact: entry.artifact.asString(), sha256: entry.sha256 }))),
    checked: checked.value === undefined ? null : CheckedUnits.of(checked.value),
    crossChecked: doc.crossChecked === undefined ? null : DesignCrossCheckedEntries.of(doc.crossChecked.map(DesignCrossCheckedEntry.of)),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
