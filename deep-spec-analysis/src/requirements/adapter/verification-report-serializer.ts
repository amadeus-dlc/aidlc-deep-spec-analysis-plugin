import type { ArtifactPath } from "@deep-spec/kernel-domain";
import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import { type Json, type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import {
  VerificationReport, VerificationReportId, VerificationFinding, VerificationFindings,
  VerificationSkipped, VerificationSkips, VerificationWitness, CrossCheckedEntries, CrossCheckedEntry,
} from "@deep-spec/requirements-domain";

export function renderVerificationReportBytes(report: VerificationReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseSiblingReportDocument(directory: ArtifactPath, fileName: string, raw: Json): Result<VerificationReport, string> {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return decoded;
  const doc = decoded.value;
  if (`${doc.backend.asString()}.json` !== fileName) return err("backend must match the report filename");
  return ok(VerificationReport.of({
    id: VerificationReportId.of(directory, doc.backend.asString()),
    irVersion: doc.irVersion, irHash: doc.irHash, method: doc.method,
    findings: VerificationFindings.of(doc.findings.map((entry) => VerificationFinding.of({
      kind: entry.kind, functionalRequirementReferences: entry.functionalRequirementReferences, targets: entry.targets,
      witness: VerificationWitness.of(entry.witness as Parameters<typeof VerificationWitness.of>[0]), detail: entry.detail,
    }))),
    skipped: VerificationSkips.of(doc.skipped.map((entry) => VerificationSkipped.of(entry))),
    crossChecked: doc.crossChecked === undefined ? null : CrossCheckedEntries.of(doc.crossChecked.map(CrossCheckedEntry.of)),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
