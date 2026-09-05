import { describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath, ContentHash, IrVersion, SkipReason, VerificationMethod } from "@deep-spec/kernel-domain";
import { IllegalArgumentException, type Json, combineResults, traverseResult, ok, err } from "@deep-spec/kernel-infrastructure";
import { parseFindingsValues } from "@deep-spec/kernel-adapter";
import {
  parseFormalModel, parseSiblingReportDocument, RequirementsSourceRepositoryImpl,
  VerificationDirectoryRepositoryImpl, VERIFICATION_LOCK_BASENAME,
} from "@deep-spec/requirements-adapter";
import { parseDesignModel } from "@deep-spec/design-adapter";
import {
  VerificationReport, VerificationReportId, VerificationFindings, VerificationSkips,
  VerificationDirectory, VerificationReports, RequirementsSource, RequirementsSourceId,
} from "@deep-spec/requirements-domain";

function document() {
  return {
    backend: "smt", irVersion: "1.0.0", irHash: "a".repeat(64), method: "exhaustive",
    findings: [{ kind: "conflict", frRefs: ["FR-1"], targets: ["OB-1"], witness: { core: [] }, detail: "conflict" }],
    skipped: [{ target: "OB-2", reason: "timeout" }],
  };
}

describe("recoverable input uses parse; construction panics propagate", () => {
  test("document fields return parse failures without invoking of for raw vocabulary", () => {
    const construction = spyOn(SkipReason, "of").mockImplementation(() => { throw new Error("raw input must use parse"); });
    try {
      expect(parseFindingsValues(document()).ok).toBe(true);
      const invalid: Json[] = [
        { ...document(), irVersion: "x" },
        { ...document(), irHash: "x" },
        { ...document(), method: "x" },
        { ...document(), findings: [{ ...document().findings[0], kind: "x" }] },
        { ...document(), findings: [{ ...document().findings[0], frRefs: ["invalid"] }] },
        { ...document(), skipped: [{ target: "OB-2", reason: "invalid" }] },
      ];
      for (const raw of invalid) expect(parseFindingsValues(raw).ok).toBe(false);
      expect(construction).not.toHaveBeenCalled();
    } finally {
      construction.mockRestore();
    }
  });

  test("model parsers report invalid IDs and bounds through Result", () => {
    const model = { irVersion: "1.0.0", schema: { entities: [] }, obligations: [], scenarios: [] };
    expect(parseFormalModel({ ...model, obligations: [{ id: "", nature: "invariant" }] }).ok).toBe(false);
    expect(parseFormalModel({ ...model, schema: { entities: [{ name: "E", attributes: [{ name: "a", type: { kind: "int", min: 0.5 } }] }] } }).ok).toBe(false);
    expect(parseDesignModel({ ...model, irKind: "design", units: [{ unit: "u1", obligations: [{ id: "", nature: "invariant" }] }] }).ok).toBe(false);
  });

  test("a report assembly panic is not converted to a decoding failure", () => {
    const panic = new IllegalArgumentException({ kind: "assembly-defect" });
    const construction = spyOn(VerificationReport, "of").mockImplementation(() => { throw panic; });
    try {
      expect(() => parseSiblingReportDocument(ArtifactPath.of("/reports"), "smt.json", document())).toThrow(panic);
    } finally {
      construction.mockRestore();
    }
  });

  test("a repository does not classify a construction panic as an I/O failure", () => {
    const root = mkdtempSync(join(tmpdir(), "source-panic-"));
    const directory = join(root, "inception", "requirements-analysis");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "requirements.md"), "FR-1");
    const panic = new IllegalArgumentException({ kind: "source-defect" });
    const construction = spyOn(RequirementsSource, "of").mockImplementation(() => { throw panic; });
    try {
      expect(() => new RequirementsSourceRepositoryImpl().findById(RequirementsSourceId.of(ArtifactPath.of(root)))).toThrow(panic);
    } finally {
      construction.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("publication propagates a domain panic and releases the lock", () => {
    const root = mkdtempSync(join(tmpdir(), "publication-panic-"));
    const directory = ArtifactPath.of(root);
    const candidate = VerificationReport.of({
      id: VerificationReportId.of(directory, "smt"), irVersion: IrVersion.of("1.0.0"),
      irHash: ContentHash.ofText("model"), method: VerificationMethod.of("exhaustive"),
      findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]), crossChecked: null, unavailableReason: null,
    });
    const aggregate = VerificationDirectory.of(directory, VerificationReports.of([]), null).finalizing(candidate);
    const panic = new IllegalArgumentException({ kind: "serialization-defect" });
    const rendering = spyOn(VerificationReport.prototype, "toDocument").mockImplementation(() => { throw panic; });
    try {
      expect(() => new VerificationDirectoryRepositoryImpl().store(aggregate)).toThrow(panic);
      expect(existsSync(join(root, VERIFICATION_LOCK_BASENAME))).toBe(false);
      expect(existsSync(join(root, "smt.json"))).toBe(false);
    } finally {
      rendering.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Result composition preserves errors, short-circuits traversal, and never catches panics", () => {
    expect(combineResults({ first: ok(1), second: err("bad") })).toEqual(err("bad"));
    expect(combineResults({})).toEqual(ok({}));
    const visited: number[] = [];
    expect(traverseResult([1, 2, 3], (n) => { visited.push(n); return n === 2 ? err("bad") : ok(n); })).toEqual(err("bad"));
    expect(visited).toEqual([1, 2]);
    const panic = new IllegalArgumentException({ kind: "callback-defect" });
    expect(() => traverseResult([1], () => { throw panic; })).toThrow(panic);
  });
});
