import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import { ArtifactPath, TargetIdentifier, TargetIdentifiers } from "@deep-spec/kernel-domain";
import {
  combineResults,
  err,
  isObject,
  type Json,
  ok,
  type Result,
  traverseResult,
} from "@deep-spec/kernel-infrastructure";
import {
  ElementPath,
  Finding,
  Findings,
  InputAnchor,
  InputAnchors,
  ReferenceCheckReport,
  type ReferenceCheckReportIdentifier,
  Skipped,
  Skips,
  WitnessReference,
  WitnessReferences,
} from "@deep-spec/refcheck-domain";

export function renderReportBytes(report: ReferenceCheckReport): string {
  return `${JSON.stringify(report.toDocument(), null, 2)}\n`;
}

export function parseReportDocument(
  id: ReferenceCheckReportIdentifier,
  raw: Json,
): Result<ReferenceCheckReport, { cause: string }> {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok) return err({ cause: decoded.error });
  const doc = decoded.value;
  if (!doc.backend.equals(id.backendName()))
    return err({
      cause: `document backend "${doc.backend.asString()}" does not match the id backend "${id.backendName().asString()}"`,
    });
  if (doc.inputs === undefined || doc.checked === undefined)
    return err({ cause: "document lacks inputs/checked/findings/skipped arrays" });
  const checked = traverseResult(doc.checked, TargetIdentifier.parse);
  if (!checked.ok) return err({ cause: JSON.stringify(checked.error) });
  const findings: Finding[] = [];
  for (const entry of doc.findings) {
    const witness = isObject(entry.witness) ? entry.witness : {};
    const refs: WitnessReference[] = [];
    for (const rawRef of Array.isArray(witness.refs) ? witness.refs : []) {
      const ref = isObject(rawRef) ? rawRef : {};
      const parsed = combineResults({
        artifact: ArtifactPath.parse(typeof ref.artifact === "string" ? ref.artifact : ""),
        element: ElementPath.parse(typeof ref.element === "string" ? ref.element : ""),
      });
      if (!parsed.ok) return err({ cause: JSON.stringify(parsed.error) });
      refs.push(
        WitnessReference.of({
          artifact: parsed.value.artifact.asString(),
          element: parsed.value.element.asString(),
          ...(typeof ref.value === "string" ? { value: ref.value } : {}),
        }),
      );
    }
    findings.push(Finding.of({ ...entry, witness: { refs: WitnessReferences.of(refs) } }));
  }
  return ok(
    ReferenceCheckReport.of({
      id,
      inputs: InputAnchors.of(
        doc.inputs.map((entry) => InputAnchor.of({ artifact: entry.artifact.asString(), sha256: entry.sha256 })),
      ),
      checked: TargetIdentifiers.of(checked.value),
      findings: Findings.of(findings),
      skipped: Skips.of(doc.skipped.map(Skipped.of)),
      unavailableReason: doc.unavailable?.reason ?? null,
    }),
  );
}
