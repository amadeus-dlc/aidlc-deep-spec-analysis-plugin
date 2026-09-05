import { VerificationMethod, FindingKind, SkipReason, RequirementId, FrRefs } from "@deep-spec/kernel-domain";

import { decodeDomainValues, decodeFindingsDocument } from "@deep-spec/kernel-adapter";

// 子センサーの文書を、欠落を補完せず型付きの結果へ復号する。

import { type Json } from "@deep-spec/kernel-infrastructure";

import { LoweredId, SiblingVerdictFindings, SiblingVerdictSkips, SiblingVerdictSkip, SiblingVerdictDocument, SiblingVerdictFinding, DesignWitness } from "@deep-spec/design-domain";

export function parseSiblingVerdictDocument(raw: Json): ReturnType<typeof parseSiblingVerdictDocumentValue> {
  const decoded = decodeDomainValues(() => parseSiblingVerdictDocumentValue(raw));
  return decoded.ok ? decoded.value : SiblingVerdictDocument.unreadable(decoded.error);
}

function parseSiblingVerdictDocumentValue(raw: Json): SiblingVerdictDocument {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return SiblingVerdictDocument.unreadable();
  const doc = decoded.value;
  if (doc.unavailable !== undefined) return SiblingVerdictDocument.unavailable(doc.unavailable.reason, VerificationMethod.of(doc.method));
  const findings = doc.findings.map((f) => SiblingVerdictFinding.of({
    kind: FindingKind.of(f.kind), frRefs: FrRefs.of(Array.from(f.frRefs, (raw) => RequirementId.of(raw))), targets: f.targets.map((t) => LoweredId.of(t)),
    witness: DesignWitness.of(f.witness), detail: f.detail,
  }));
  const skipped = doc.skipped.map((s) => SiblingVerdictSkip.of({
    target: LoweredId.of(s.target), reason: SkipReason.of(s.reason),
    ...(s.detail !== undefined ? { detail: s.detail } : {}),
  }));
  return SiblingVerdictDocument.readable( VerificationMethod.of(doc.method), SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
}
