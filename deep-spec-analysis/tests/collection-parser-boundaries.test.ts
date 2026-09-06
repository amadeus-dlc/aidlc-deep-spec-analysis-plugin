import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import { CheckFamilies, CheckFamily, ReferenceCheckReport } from "@deep-spec-analysis/refcheck-domain";
import { parseRequirementIdentifiers } from "../src/kernel/adapter/requirement-identifiers-parser.ts";
import { parseComponentCatalog } from "../src/refcheck/adapter/component-catalog-parser.ts";
import { DesignRecordRepositoryImplementation } from "../src/refcheck/adapter/design-record-repository-implementation.ts";
import {
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
} from "../src/refcheck/adapter/functional-design-parser.ts";
import { parseReportDocument } from "../src/refcheck/adapter/reference-check-report-serializer.ts";
import { DesignRecordIdentifier } from "../src/refcheck/domain/design-record-identifier.ts";
import { ReferenceCheckReportIdentifier } from "../src/refcheck/domain/reference-check-report-identifier.ts";
import { parseFormalModel } from "../src/requirements/adapter/formal-model-parser.ts";

test("formal model parser turns an oversized external collection into a Result error", () => {
  const result = parseFormalModel({
    irVersion: "1.0.0",
    obligations: Array.from({ length: 65_537 }, (_, index) => ({
      id: `OB-${index + 1}`,
      nature: "invariant",
    })),
  });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("too-many-obligations");
});

test("reference report parser rejects oversized checked targets without throwing", () => {
  const result = parseReportDocument(ReferenceCheckReportIdentifier.of(ArtifactPath.of("/records/report"), "smt"), {
    backend: "smt",
    irVersion: "1.0.0",
    irHash: "a".repeat(64),
    method: "exhaustive",
    inputs: [],
    checked: Array.from({ length: 65_537 }, () => "OB-1"),
    findings: [],
    skipped: [],
  });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.cause).toContain("too-many-target-identifiers");
});

test("functional-design parser reports an oversized entities collection as unparseable", () => {
  const entities = Array.from({ length: 65_537 }, (_, index) => `  - name: Entity${index + 1}`).join("\n");
  const outcome = parseEntitiesDocument(["```yaml", "entities:", entities, "```", ""].join("\n"));

  const kind = outcome.match({
    absent: () => "absent",
    wrongFenceCount: () => "wrong-fence-count",
    unparseable: (_line, error) => error,
    extracted: () => "extracted",
  });
  expect(kind).toContain("too-many-entity-declarations");
});

test("component catalog parser reports an oversized components collection as unparseable", () => {
  const components = Array.from({ length: 65_537 }, (_, index) => `  - name: Component${index + 1}`).join("\n");
  const outcome = parseComponentCatalog(["```yaml", "components:", components, "```", ""].join("\n"));

  const kind = outcome.match({
    wrongFenceCount: () => "wrong-fence-count",
    unparseable: (_line, error) => error,
    extracted: () => "extracted",
  });
  expect(kind).toContain("too-many-components");
});

test("functional-design parser reports an oversized state-machine collection as unparseable", () => {
  const document = Array.from({ length: 65_537 }, () => "## State Machine: \n").join("");
  const outcome = parseFunctionalSpecDocument(document);
  const kind = outcome.match({
    absent: () => "absent",
    unparseable: (error) => error.asString(),
    present: () => "present",
  });
  expect(kind).toContain("too-many-state-machine-sketches");
  const report = ReferenceCheckReport.open(
    ReferenceCheckReportIdentifier.of(ArtifactPath.of("/record/verify"), "refcheck-functional"),
    CheckFamilies.of([CheckFamily.of("FD-S1"), CheckFamily.of("FD-S2")]),
  );
  outcome.check(report, ArtifactPath.of("functional-spec.md"), ArtifactPath.of("entities.md"), null);
  expect(report.checked().toStrings()).toEqual([]);
  expect([...report.skipped()].map((skip) => [skip.target(), skip.reason()])).toEqual([
    ["check:FD-S1", "unrecognized-format"],
    ["check:FD-S2", "unrecognized-format"],
  ]);
  expect([...report.skipped()].every((skip) => skip.detail()?.includes("too-many-state-machine-sketches"))).toBe(true);
});

test("functional-design parser reads only own YAML properties", () => {
  const outcome = parseEntitiesDocument(
    ["```yaml", "__proto__:", "  entities:", "    - name: Ghost", "```", ""].join("\n"),
  );
  const entityCount = outcome.match({
    absent: () => -1,
    wrongFenceCount: () => -1,
    unparseable: () => -1,
    extracted: (model) => model.entities().toArray().length,
  });
  expect(entityCount).toBe(0);
});

test("design record acquisition reports an invalid unit directory name", () => {
  const root = mkdtempSync(join(tmpdir(), "deep-spec-invalid-unit-"));
  const unit = "u".repeat(129);
  const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
  const fd = join(record, "construction", unit, "functional-design");
  try {
    mkdirSync(fd, { recursive: true });
    writeFileSync(join(record, "aidlc-state.md"), "state\n");
    const path = join(fd, "entities.md");
    writeFileSync(path, "entities\n");
    const result = new DesignRecordRepositoryImplementation().findById(
      DesignRecordIdentifier.of(ArtifactPath.of(path)),
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "corrupt") expect(result.error.cause).toContain("unit-name-too-long");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requirement identifier extraction reports an oversized token through parse", () => {
  const result = parseRequirementIdentifiers(`FR-${"9".repeat(2_000)}`);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe("requirement-id-too-long");
});
