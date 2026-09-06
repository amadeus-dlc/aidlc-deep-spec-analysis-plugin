import {
  CheckedUnits,
  DesignCrossCheckedEntries,
  DesignCrossCheckedEntry,
  DesignFinding,
  DesignFindings,
  DesignInputAnchor,
  DesignInputAnchors,
  DesignReport,
  DesignReportIdentifier,
  DesignSkipped,
  DesignSkips,
  DesignWitness,
} from "@deep-spec-analysis/design-domain";
import { parseFindingsValues } from "@deep-spec-analysis/kernel-adapter";
import { type ArtifactPath, UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  combineResults,
  err,
  type Json,
  ok,
  type Result,
  traverseResult,
} from "@deep-spec-analysis/kernel-infrastructure";

export function renderDesignReportBytes(report: DesignReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingDesignReportDocument(
  directory: ArtifactPath,
  fileName: string,
  raw: Json,
): Result<DesignReport, string> {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return decoded;
  const doc = decoded.value;
  if (`${doc.backend.asString()}.json` !== fileName) return err("backend must match the report filename");
  const findings: DesignFinding[] = [];
  for (const entry of doc.findings) {
    if (entry.unit === undefined) return err("design finding requires a unit");
    const witness = DesignWitness.parse(entry.witness);
    if (!witness.ok) return err(JSON.stringify(witness.error));
    findings.push(DesignFinding.of({ ...entry, unit: entry.unit, witness: witness.value }));
  }
  const skipped: DesignSkipped[] = [];
  for (const entry of doc.skipped) {
    if (entry.unit === undefined) return err("design skip requires a unit");
    skipped.push(DesignSkipped.of({ ...entry, unit: entry.unit }));
  }
  const checked = doc.checked === undefined ? ok(undefined) : traverseResult(doc.checked, UnitName.parse);
  if (!checked.ok) return err(JSON.stringify(checked.error));
  const comparisons =
    doc.crossChecked === undefined
      ? ok(null)
      : traverseResult(doc.crossChecked, (entry) => {
          if (entry.unit === undefined) return err("design cross-check requires a unit");
          const parsed = DesignCrossCheckedEntry.parse({ ...entry, unit: entry.unit });
          return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
        });
  if (!comparisons.ok) return comparisons;
  const collections = combineResults({
    findings: DesignFindings.parse(findings),
    skipped: DesignSkips.parse(skipped),
    inputs:
      doc.inputs === undefined
        ? ok(null)
        : DesignInputAnchors.parse(
            doc.inputs.map((entry) =>
              DesignInputAnchor.of({ artifact: entry.artifact.asString(), sha256: entry.sha256 }),
            ),
          ),
    checked: checked.value === undefined ? ok(null) : CheckedUnits.parse(checked.value),
    crossChecked: comparisons.value === null ? ok(null) : DesignCrossCheckedEntries.parse(comparisons.value),
  });
  if (!collections.ok) return err(JSON.stringify(collections.error));
  return ok(
    DesignReport.of({
      id: DesignReportIdentifier.of(directory, doc.backend.asString()),
      irVersion: doc.irVersion,
      irHash: doc.irHash,
      method: doc.method,
      ...collections.value,
      unavailableReason: doc.unavailable?.reason ?? null,
    }),
  );
}
