import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBackendEvidence } from "@deep-spec-analysis/doctor-adapter";
import {
  DesignArtifactReference,
  FindingCount,
  IntentLocation,
  StructuralDebt,
  StructuralObservation,
  VerificationEvidence,
} from "@deep-spec-analysis/doctor-domain";
import { ArtifactPath, ContentHash, ErrorMessage, SkipReason, UnitName } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException, type Json } from "@deep-spec-analysis/kernel-infrastructure";

const hash = ContentHash.ofText("ir");

function document(overrides: { [key: string]: Json } = {}): string {
  return JSON.stringify({
    backend: "smt",
    irVersion: "1.0.0",
    irHash: hash.asString(),
    method: "exhaustive",
    findings: [],
    skipped: [],
    checked: ["unit:u1"],
    ...overrides,
  });
}

function artifact(): DesignArtifactReference {
  return DesignArtifactReference.of({
    location: IntentLocation.of(ArtifactPath.of("default"), ArtifactPath.of("intent")),
    tool: ArtifactPath.of("tool.ts"),
    artifactPath: ArtifactPath.of("/record/artifact.md"),
    relativePath: ArtifactPath.of("artifact.md"),
  });
}

test("backend evidence reads only smt/quint and preserves checked units and hash", () => {
  const directory = mkdtempSync(join(tmpdir(), "doctor-evidence-"));
  try {
    writeFileSync(join(directory, "smt.json"), document());
    writeFileSync(join(directory, "ignored.json"), "not read");
    const result = readBackendEvidence(directory);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.countsFor(hash)).toBe(true);
      expect(result.value[0]?.completedUnitsFor(hash).map((unit) => unit.asString())).toEqual(["u1"]);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("backend evidence distinguishes unavailable and skipped evidence from completed evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "doctor-evidence-state-"));
  try {
    writeFileSync(
      join(directory, "smt.json"),
      document({ unavailable: { reason: "backend unavailable" }, checked: [] }),
    );
    writeFileSync(
      join(directory, "quint.json"),
      document({ backend: "quint", skipped: [{ target: "OB-1", reason: "timeout" }] }),
    );
    const result = readBackendEvidence(directory);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.every((evidence) => !evidence.countsFor(hash))).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("backend evidence returns corrupt for invalid JSON and empty for a missing directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "doctor-evidence-invalid-"));
  try {
    writeFileSync(join(directory, "smt.json"), "{");
    const invalid = readBackendEvidence(directory);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.kind).toBe("corrupt");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const missing = readBackendEvidence(join(tmpdir(), "doctor-evidence-does-not-exist"));
  expect(missing).toEqual({ ok: true, value: [] });
});

test("structural observations retain partial and unavailable rows", () => {
  const source = artifact();
  const partial = StructuralObservation.partial(source, FindingCount.of(2), ErrorMessage.of("skipped"));
  const unavailable = StructuralObservation.unavailable(source, ErrorMessage.of("unavailable"));
  const debt = StructuralDebt.of([partial, unavailable]);

  expect(partial.wasScanned()).toBe(true);
  expect(partial.isComplete()).toBe(false);
  expect(unavailable.wasScanned()).toBe(false);
  expect(debt.isComplete()).toBe(false);
  expect(debt.rows()).toHaveLength(2);
  expect(debt.totalFindings()).toBe(2);
  expect(
    partial.match({
      complete: () => "complete",
      partial: (findings) => `partial:${findings.asNumber()}`,
      unavailable: () => "unavailable",
    }),
  ).toBe("partial:2");
});

test("verification evidence owns bounded input snapshots", () => {
  const checked = [UnitName.of("unit:u1")];
  const skipped = [SkipReason.waived()];
  const evidence = VerificationEvidence.of({
    irHash: hash,
    unavailable: null,
    skippedReasons: skipped,
    checkedUnits: checked,
  });
  checked.push(UnitName.of("unit:u2"));
  skipped.push(SkipReason.timeout());

  expect(evidence.countsFor(hash)).toBe(true);
  expect(evidence.completedUnitsFor(hash).map((unit) => unit.asString())).toEqual(["unit:u1"]);
});

test("evidence equality includes hash, availability, skip reasons and completed units", () => {
  const base = {
    irHash: hash,
    unavailable: null,
    skippedReasons: [SkipReason.waived()],
    checkedUnits: [UnitName.of("u1")],
  };
  const first = VerificationEvidence.of(base);
  expect(first.equals(VerificationEvidence.of({ ...base }))).toBe(true);
  for (const changes of [
    { irHash: ContentHash.ofText("other") },
    { unavailable: ErrorMessage.of("offline") },
    { skippedReasons: [] },
    { skippedReasons: [SkipReason.timeout()] },
    { checkedUnits: [] },
    { checkedUnits: [UnitName.of("u2")] },
  ])
    expect(first.equals(VerificationEvidence.of({ ...base, ...changes }))).toBe(false);
  const unavailable = VerificationEvidence.of({ ...base, unavailable: ErrorMessage.of("offline") });
  expect(unavailable.equals(first)).toBe(false);
  expect(unavailable.equals(VerificationEvidence.of({ ...base, unavailable: ErrorMessage.of("offline") }))).toBe(true);
  expect(unavailable.equals(VerificationEvidence.of({ ...base, unavailable: ErrorMessage.of("timeout") }))).toBe(false);
  expect(first.completedUnitsFor(ContentHash.ofText("other"))).toEqual([]);
});

test("evidence of panics and parse returns nonexception errors for oversized collections", () => {
  const base = { irHash: hash, unavailable: null, skippedReasons: [], checkedUnits: [] };
  expect(VerificationEvidence.parse(base).ok).toBe(true);
  for (const changes of [
    { skippedReasons: Array.from({ length: 65_537 }, () => SkipReason.waived()) },
    { checkedUnits: Array.from({ length: 65_537 }, () => UnitName.of("u1")) },
  ]) {
    expect(() => VerificationEvidence.of({ ...base, ...changes })).toThrow(IllegalArgumentException);
    const parsed = VerificationEvidence.parse({ ...base, ...changes });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
});
