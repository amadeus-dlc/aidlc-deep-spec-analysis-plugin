import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import type { Json } from "@deep-spec/kernel-infrastructure";
import {
  LoweredId, SiblingVerdictFindings, SiblingVerdictSkips, SiblingVerdictSkip,
  SiblingVerdictDocument, SiblingVerdictFinding, DesignWitness,
} from "@deep-spec/design-domain";

export function parseSiblingVerdictDocument(raw: Json): SiblingVerdictDocument {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return SiblingVerdictDocument.unreadable(decoded.error);
  const doc = decoded.value;
  if (doc.unavailable !== undefined) return SiblingVerdictDocument.unavailable(doc.unavailable.reason, doc.method);
  const findings = doc.findings.map((f) => SiblingVerdictFinding.of({
    kind: f.kind, frRefs: f.frRefs,
    targets: [...f.targets].map((target) => LoweredId.of(target.asString())),
    witness: DesignWitness.of(f.witness), detail: f.detail,
  }));
  const skipped = doc.skipped.map((s) => SiblingVerdictSkip.of({
    target: LoweredId.of(s.target.asString()), reason: s.reason, detail: s.detail,
  }));
  return SiblingVerdictDocument.readable(doc.method, SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
}
