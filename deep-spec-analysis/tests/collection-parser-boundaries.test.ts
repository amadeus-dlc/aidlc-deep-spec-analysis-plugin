import { expect, test } from "bun:test";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import { parseRequirementIdentifiers } from "../src/kernel/adapter/requirement-identifiers-parser.ts";
import { parseComponentCatalog } from "../src/refcheck/adapter/component-catalog-parser.ts";
import { parseEntitiesDocument } from "../src/refcheck/adapter/functional-design-parser.ts";
import { parseReportDocument } from "../src/refcheck/adapter/reference-check-report-serializer.ts";
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

test("requirement identifier extraction reports an oversized token through parse", () => {
  const result = parseRequirementIdentifiers(`FR-${"9".repeat(2_000)}`);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe("requirement-id-too-long");
});
