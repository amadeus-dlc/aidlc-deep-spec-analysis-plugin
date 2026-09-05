// 子センサーの文書を、欠落を補完せず型付きの結果へ復号する。
import { FrRefs } from "@deep-spec/kernel-domain";
import { type Json } from "@deep-spec/kernel-infrastructure";
import { decodeFindingsDocument } from "@deep-spec/kernel-adapter";
import { LoweredId, SiblingVerdictFindings, SiblingVerdictSkips, SiblingVerdictSkip, SiblingVerdictDocument, SiblingVerdictFinding, DesignWitness } from "@deep-spec/design-domain";

export function parseSiblingVerdictDocument(raw: Json): SiblingVerdictDocument {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return SiblingVerdictDocument.unreadable();
  const doc = decoded.value;
  if (doc.unavailable !== undefined) return SiblingVerdictDocument.unavailable(doc.unavailable.reason, doc.method);
  const findings = doc.findings.map((f) => SiblingVerdictFinding.reconstitute({
    kind: f.kind, frRefs: FrRefs.reconstitute(f.frRefs), targets: f.targets.map((t) => LoweredId.reconstitute(t)),
    witness: DesignWitness.fromDocument(f.witness), detail: f.detail,
  }));
  const skipped = doc.skipped.map((s) => SiblingVerdictSkip.reconstitute({
    target: LoweredId.reconstitute(s.target), reason: s.reason,
    ...(s.detail !== undefined ? { detail: s.detail } : {}),
  }));
  return SiblingVerdictDocument.readable(doc.method, SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
}
