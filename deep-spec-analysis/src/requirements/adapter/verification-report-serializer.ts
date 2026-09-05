import type { ArtifactPath } from "@deep-spec/kernel-domain";
import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import { type Json, type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import {
  VerificationReport, VerificationReportIdentifier, VerificationFinding, VerificationFindings,
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
  const findings: VerificationFinding[] = [];
  for (const entry of doc.findings) {
    const witness = VerificationWitness.parse(entry.witness as Parameters<typeof VerificationWitness.parse>[0]);
    if (!witness.ok) return err(JSON.stringify(witness.error));
    findings.push(VerificationFinding.of({
      kind: entry.kind, functionalRequirementReferences: entry.functionalRequirementReferences, targets: entry.targets,
      witness: witness.value, detail: entry.detail,
    }));
  }
  return ok(VerificationReport.of({
    id: VerificationReportIdentifier.of(directory, doc.backend.asString()),
    irVersion: doc.irVersion, irHash: doc.irHash, method: doc.method,
    findings: VerificationFindings.of(findings),
    skipped: VerificationSkips.of(doc.skipped.map((entry) => VerificationSkipped.of(entry))),
    crossChecked: doc.crossChecked === undefined ? null : CrossCheckedEntries.of(doc.crossChecked.map(CrossCheckedEntry.of)),
    unavailableReason: doc.unavailable?.reason ?? null,
  }));
}
