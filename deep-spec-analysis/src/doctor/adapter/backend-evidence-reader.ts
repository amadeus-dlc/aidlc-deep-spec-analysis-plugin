import { join } from "node:path";
import { VerificationEvidence } from "@deep-spec-analysis/doctor-domain";
import { parseFindingsValues, readArtifactText, readDirectory } from "@deep-spec-analysis/kernel-adapter";
import { ErrorMessage, TargetIdentifier, UnitName } from "@deep-spec-analysis/kernel-domain";
import { err, type Json, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";

const BACKENDS = ["smt.json", "quint.json"] as const;

export function readBackendEvidence(directory: string): Result<readonly VerificationEvidence[], RepositoryError> {
  const listing = readDirectory(directory);
  if (!listing.ok) return listing.error.kind === "not-found" ? ok([]) : err(listing.error);
  const names = new Set(listing.value.map((entry) => entry.name));
  const evidence: VerificationEvidence[] = [];
  for (const backend of BACKENDS) {
    if (!names.has(backend)) continue;
    const path = join(directory, backend);
    const read = readArtifactText(path);
    if (!read.ok) return err(read.error);
    let raw: Json;
    try {
      raw = JSON.parse(read.value) as Json;
    } catch (error) {
      return err({ kind: "corrupt", path, cause: error instanceof Error ? error.message : String(error) });
    }
    const parsed = parseFindingsValues(raw);
    if (!parsed.ok) return err({ kind: "corrupt", path, cause: parsed.error });
    if (parsed.value.backend.asString() !== backend.slice(0, -5))
      return err({ kind: "corrupt", path, cause: "findings backend does not match its filename" });
    const unavailable =
      parsed.value.unavailable === undefined ? null : ErrorMessage.parse(parsed.value.unavailable.reason);
    if (unavailable !== null && !unavailable.ok)
      return err({ kind: "corrupt", path, cause: JSON.stringify(unavailable.error) });
    const checkedUnits: UnitName[] = [];
    for (const checked of parsed.value.checked ?? []) {
      const target = TargetIdentifier.parse(checked);
      if (!target.ok || !checked.startsWith("unit:"))
        return err({
          kind: "corrupt",
          path,
          cause: JSON.stringify(target.ok ? { kind: "checked-unit-prefix" } : target.error),
        });
      const unit = UnitName.parse(checked.slice("unit:".length));
      if (!unit.ok) return err({ kind: "corrupt", path, cause: JSON.stringify(unit.error) });
      checkedUnits.push(unit.value);
    }
    const built = VerificationEvidence.parse({
      irHash: parsed.value.irHash,
      unavailable: unavailable === null ? null : unavailable.value,
      skippedReasons: parsed.value.skipped.map((entry) => entry.reason),
      checkedUnits,
    });
    if (!built.ok) return err({ kind: "corrupt", path, cause: JSON.stringify(built.error) });
    evidence.push(built.value);
  }
  return ok(Object.freeze(evidence));
}
