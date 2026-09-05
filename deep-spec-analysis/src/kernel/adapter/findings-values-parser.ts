import {
  ArtifactPath, BackendName, ContentHash, FindingKind, FunctionalRequirementReferences, IrVersion,
  RequirementId, SkipReason, TargetId, TargetIds, UnitName, VerificationMethod,
} from "@deep-spec/kernel-domain";
import { type Json, combineResults, traverseResult, err, ok } from "@deep-spec/kernel-infrastructure";
import { decodeFindingsDocument } from "./findings-document.ts";

// 外部文書の生値は各DPのparseへ渡す。ofのpanicを入力エラーに読み替えない。
export function parseFindingsValues(raw: Json) {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok) return decoded;
  const doc = decoded.value;
  const parsed = combineResults({
    backend: BackendName.parse(doc.backend),
    irVersion: IrVersion.parse(doc.irVersion),
    irHash: ContentHash.parse(doc.irHash),
    method: VerificationMethod.parse(doc.method),
    findings: traverseResult(doc.findings, (entry) => {
      const fields = combineResults({
        kind: FindingKind.parse(entry.kind),
        functionalRequirementReferences: traverseResult(entry.frRefs, RequirementId.parse),
        targets: traverseResult(entry.targets, TargetId.parse),
        unit: entry.unit === undefined ? ok(undefined) : UnitName.parse(entry.unit),
      });
      if (!fields.ok) return fields;
      return ok({ ...fields.value, functionalRequirementReferences: FunctionalRequirementReferences.of(fields.value.functionalRequirementReferences), targets: TargetIds.of(fields.value.targets), witness: entry.witness, detail: entry.detail });
    }),
    skipped: traverseResult(doc.skipped, (entry) => {
      const fields = combineResults({
        target: TargetId.parse(entry.target),
        reason: SkipReason.parse(entry.reason),
        unit: entry.unit === undefined ? ok(undefined) : UnitName.parse(entry.unit),
      });
      if (!fields.ok) return fields;
      return ok({ ...fields.value, detail: entry.detail });
    }),
    inputs: doc.inputs === undefined ? ok(undefined) : traverseResult(doc.inputs, (entry) => combineResults({
      artifact: ArtifactPath.parse(entry.artifact), sha256: ContentHash.parse(entry.sha256),
    })),
    crossChecked: doc.crossChecked === undefined ? ok(undefined) : traverseResult(doc.crossChecked, (entry) => {
      const fields = combineResults({ backend: BackendName.parse(entry.backend), targets: traverseResult(entry.targets, TargetId.parse) });
      if (!fields.ok) return fields;
      return ok({ backend: fields.value.backend, targets: TargetIds.of(fields.value.targets) });
    }),
  });
  if (!parsed.ok) return err(JSON.stringify(parsed.error));
  return ok({ ...parsed.value, checked: doc.checked, unavailable: doc.unavailable });
}
