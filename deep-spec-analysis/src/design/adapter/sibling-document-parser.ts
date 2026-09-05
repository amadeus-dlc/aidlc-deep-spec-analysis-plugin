import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import { combineResults, traverseResult, type Json } from "@deep-spec/kernel-infrastructure";
import {
  LoweredIdentifier, SiblingVerdictFindings, SiblingVerdictSkips, SiblingVerdictSkip,
  SiblingVerdictDocument, SiblingVerdictFinding, DesignWitness,
} from "@deep-spec/design-domain";

export function parseSiblingVerdictDocument(raw: Json): SiblingVerdictDocument {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return SiblingVerdictDocument.unreadable(decoded.error);
  const doc = decoded.value;
  if (doc.unavailable !== undefined) return SiblingVerdictDocument.unavailable(doc.unavailable.reason, doc.method);
  const findings: SiblingVerdictFinding[] = [];
  for (const finding of doc.findings) {
    const fields = combineResults({
      targets: traverseResult([...finding.targets], (target) => LoweredIdentifier.parse(target.asString())),
      witness: DesignWitness.parse(finding.witness),
    });
    if (!fields.ok) return SiblingVerdictDocument.unreadable(JSON.stringify(fields.error));
    findings.push(SiblingVerdictFinding.of({ ...finding, ...fields.value }));
  }
  const skipped: SiblingVerdictSkip[] = [];
  for (const skip of doc.skipped) {
    const target = LoweredIdentifier.parse(skip.target.asString());
    if (!target.ok) return SiblingVerdictDocument.unreadable(JSON.stringify(target.error));
    skipped.push(SiblingVerdictSkip.of({ ...skip, target: target.value }));
  }
  return SiblingVerdictDocument.readable(doc.method, SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
}
