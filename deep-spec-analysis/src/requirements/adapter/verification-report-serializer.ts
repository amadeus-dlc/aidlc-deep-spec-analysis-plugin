import { parseFindingsValues } from "@deep-spec-analysis/kernel-adapter";
import type { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import { err, type Json, ok, type Result, traverseResult } from "@deep-spec-analysis/kernel-infrastructure";
import {
  CrossCheckedEntries,
  CrossCheckedEntry,
  VerificationFinding,
  VerificationFindings,
  VerificationReport,
  VerificationReportIdentifier,
  VerificationSkipped,
  VerificationSkips,
  VerificationWitness,
} from "@deep-spec-analysis/requirements-domain";

export function renderVerificationReportBytes(report: VerificationReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingReportDocument(
  directory: ArtifactPath,
  fileName: string,
  raw: Json,
): Result<VerificationReport, string> {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return decoded;
  const doc = decoded.value;
  if (`${doc.backend.asString()}.json` !== fileName) return err("backend must match the report filename");
  const findings: VerificationFinding[] = [];
  for (const entry of doc.findings) {
    const witness = VerificationWitness.parse(entry.witness as Parameters<typeof VerificationWitness.parse>[0]);
    if (!witness.ok) return err(JSON.stringify(witness.error));
    findings.push(
      VerificationFinding.of({
        kind: entry.kind,
        functionalRequirementReferences: entry.functionalRequirementReferences,
        targets: entry.targets,
        witness: witness.value,
        detail: entry.detail,
      }),
    );
  }
  const comparisons =
    doc.crossChecked === undefined
      ? ok(null)
      : traverseResult(doc.crossChecked, (entry) => {
          if (entry.unit !== undefined) return err("requirements cross-check must not carry a unit");
          const parsed = CrossCheckedEntry.parse(entry);
          return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
        });
  if (!comparisons.ok) return comparisons;
  return ok(
    VerificationReport.of({
      id: VerificationReportIdentifier.of(directory, doc.backend.asString()),
      irVersion: doc.irVersion,
      irHash: doc.irHash,
      method: doc.method,
      findings: VerificationFindings.of(findings),
      skipped: VerificationSkips.of(doc.skipped.map((entry) => VerificationSkipped.of(entry))),
      crossChecked: comparisons.value === null ? null : CrossCheckedEntries.of(comparisons.value),
      unavailableReason: doc.unavailable?.reason ?? null,
    }),
  );
}
