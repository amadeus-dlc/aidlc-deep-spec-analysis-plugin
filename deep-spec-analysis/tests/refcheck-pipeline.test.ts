// レイヤード refcheck パイプラインの in-process 検証（PR2b/PR3 前段、#15）。
//
// 1) golden 同値：broken/clean fixture を tmp へ複製し、interactor 正形の
//    ユースケース（Repository 保持・execute(識別)・内部で集約解決）を実 Impl
//    で駆動して、書かれたバイトを期待 golden と比較する。CLI spawn の golden
//    テストと合わせ、同一バイトへの独立経路が 2 本になる。
// 2) skip 分岐の網羅：fixture が踏まない absent/blocked/unsupported 系の分岐を
//    型付き outcome でドメイン検査に直接与えて固定する（domain 90% 床）。
// 3) interactor のテスト容易性：InMemory ダブルだけで use case が素の値として
//    組めることを証明する。

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readContractSchema } from "../tools/kernel/adapter/index.ts";
import { RequirementIds, ContentHash, ArtifactPath } from "../tools/kernel/domain/index.ts";
// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

import {
  DesignRecordRepositoryImpl,
  ReferenceCheckReportRepositoryImpl,
  conformToContract,
  parseComponentCatalog,
  parseDomainEntitiesDocument,
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
  parseRulesDocument,
  renderReportBytes,
} from "../tools/refcheck/adapter/index.ts";
import {
  CheckContractSummaryUseCase,
  CheckDomainComponentsUseCase,
  CheckFunctionalDesignUseCase,
} from "../tools/refcheck/usecase/index.ts";
import {
  CheckFamilyLedger,
  COMPONENT_FAMILIES,
  CONTRACT_FAMILIES,
  FUNCTIONAL_FAMILIES,
  type FunctionalCheckMaterialsSeed,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  ComponentCheckMaterials,
  ContractCheckMaterials,
  FunctionalCheckMaterials,
  InputAnchors,
  BlockIndex,
  CheckFamilies,
  CheckFamily,
  ContractRows,
  LineNumber,
  SpecBlockAssessments,
  UnitName,
  AttributeName,
  AttributeNames,
  DesignRecordId,
  EntityName,
  SiblingUnitIndex,
} from "../tools/refcheck/domain/index.ts";
import { InMemoryReferenceCheckReportRepository } from "./doubles/in-memory-reference-check-report-repository.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pluginRoot, "tests", "fixtures", "refcheck");
const schemaPath = join(pluginRoot, "tools", "data", "deep-spec-findings-schema.json");
const schema = readContractSchema(schemaPath);

function golden(variant: string, file: string): string {
  return readFileSync(join(fixtures, "expected", variant, file), "utf-8");
}

function realRepositories() {
  return {
    designRecords: new DesignRecordRepositoryImpl(),
    reports: new ReferenceCheckReportRepositoryImpl(schemaPath),
  };
}

describe("in-process golden equivalence (interactor use cases over real Impls)", () => {
  for (const variant of ["broken", "clean"] as const) {
    test(`${variant}: all three use cases reproduce the golden bytes without a child process`, () => {
      const record = mkdtempSync(join(tmpdir(), "refcheck-usecase-"));
      try {
        cpSync(join(fixtures, variant), record, { recursive: true });
        const { designRecords, reports } = realRepositories();

        const componentsPath = join(record, "inception", "domain-design", "components.md");
        const domainOutcome = new CheckDomainComponentsUseCase(designRecords, reports, reports).execute({
          recordId: DesignRecordId.of(ap(componentsPath)),
          reportDirectory: ap(join(dirname(componentsPath), "deep-spec-refcheck")),
          mode: "persist",
        });
        expect(domainOutcome.kind).toBe("verified");
        const rec = new DesignRecordRepositoryImpl().findById(DesignRecordId.of(ap(componentsPath)));
        expect(rec.ok && rec.value.id().equals(DesignRecordId.of(ap(componentsPath)))).toBe(true);
        expect(readFileSync(join(dirname(componentsPath), "deep-spec-refcheck", "components.json"), "utf-8"))
          .toBe(golden(variant, "components.json"));

        const contractPath = join(record, "inception", "contract-design", "contract-summary.md");
        const contractOutcome = new CheckContractSummaryUseCase(designRecords, reports, reports).execute({
          recordId: DesignRecordId.of(ap(contractPath)),
          reportDirectory: ap(join(dirname(contractPath), "deep-spec-refcheck")),
          mode: "persist",
        });
        expect(contractOutcome.kind).toBe("verified");
        expect(readFileSync(join(dirname(contractPath), "deep-spec-refcheck", "contract-summary.json"), "utf-8"))
          .toBe(golden(variant, "contract-summary.json"));

        const entitiesPath = join(record, "construction", "u1-orders", "functional-design", "entities.md");
        const functionalOutcome = new CheckFunctionalDesignUseCase(designRecords, reports, reports).execute({
          recordId: DesignRecordId.of(ap(entitiesPath)),
          reportDirectory: ap(join(dirname(entitiesPath), "deep-spec-refcheck")),
          mode: "persist",
        });
        expect(functionalOutcome.kind).toBe("verified");
        expect(readFileSync(join(dirname(entitiesPath), "deep-spec-refcheck", "functional-design.json"), "utf-8"))
          .toBe(golden(variant, "functional-design.json"));
      } finally {
        rmSync(record, { recursive: true, force: true });
      }
    });
  }

  test("an unreadable target resolves to not-applicable, and report-only writes nothing", () => {
    const { designRecords, reports } = realRepositories();
    const missing = new CheckDomainComponentsUseCase(designRecords, reports, reports).execute({
      recordId: DesignRecordId.of(ap("/nonexistent/components.md")),
      reportDirectory: ap("/nonexistent/deep-spec-refcheck"),
      mode: "persist",
    });
    expect(missing.kind).toBe("not-applicable");

    const record = mkdtempSync(join(tmpdir(), "refcheck-usecase-"));
    try {
      cpSync(join(fixtures, "broken"), record, { recursive: true });
      const componentsPath = join(record, "inception", "domain-design", "components.md");
      const outcome = new CheckDomainComponentsUseCase(designRecords, reports, reports).execute({
        recordId: DesignRecordId.of(ap(componentsPath)),
        reportDirectory: ap(join(dirname(componentsPath), "deep-spec-refcheck")),
        mode: "report-only",
      });
      expect(outcome.kind).toBe("verified");
      expect(outcome.kind === "verified" && outcome.pass).toBe(false);
      const written = new ReferenceCheckReportRepositoryImpl(schemaPath).findById(
        ReferenceCheckReportId.of(ap(join(dirname(componentsPath), "deep-spec-refcheck")), "components"),
      );
      expect(!written.ok && written.error.kind).toBe("not-found");
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  });

  test("the use case runs against the InMemory double alone (plain-value wiring)", () => {
    const record = mkdtempSync(join(tmpdir(), "refcheck-usecase-"));
    try {
      cpSync(join(fixtures, "clean"), record, { recursive: true });
      const reports = new InMemoryReferenceCheckReportRepository(schema);
      const componentsPath = join(record, "inception", "domain-design", "components.md");
      const reportDirectory = ap(join(dirname(componentsPath), "deep-spec-refcheck"));
      const outcome = new CheckDomainComponentsUseCase(new DesignRecordRepositoryImpl(), reports, reports).execute({
        recordId: DesignRecordId.of(ap(componentsPath)),
        reportDirectory,
        mode: "persist",
      });
      expect(outcome.kind === "verified" && outcome.pass).toBe(true);
      const stored = reports.findById(ReferenceCheckReportId.of(reportDirectory, "components"));
      expect(stored.ok && renderReportBytes(stored.value)).toBe(golden("clean", "components.json"));
    } finally {
      rmSync(record, { recursive: true, force: true });
    }
  });
});

// --- 以下はドメイン検査の分岐固定（use case を介さない直接駆動） -------------

function domainReport(
  families: CheckFamilies,
  run: (ledger: CheckFamilyLedger) => void,
  backend = "components",
  unit?: UnitName,
): ReferenceCheckReport {
  const ledger = CheckFamilyLedger.of(families, unit);
  run(ledger);
  return ReferenceCheckReport.compose({
    id: ReferenceCheckReportId.of(ap("/tmp/r"), backend),
    inputs: InputAnchors.of([{ artifact: "x.md", sha256: ContentHash.reconstitute("a".repeat(64)) }]),
    checked: ledger.checkedTargets(),
    findings: ledger.findings(),
    skipped: ledger.skipped(),
  });
}

describe("skip branches the fixtures do not exercise", () => {
  test("a broken components fence blocks DD-1..DD-7 with unrecognized-format skips", () => {
    const report = domainReport(COMPONENT_FAMILIES, (l) =>
      ComponentCheckMaterials.of({ outcome: parseComponentCatalog("no fence at all"), artifact: ap("components.md") }).runChecks(l));
    expect(report.findingsCount()).toBe(1);
    expect(report.skippedCount()).toBe(7);
    expect(report.skipped().toArray().every((s) => s.reason === "unrecognized-format")).toBe(true);
    expect(report.checked().toArray()).toEqual([]);
  });

  test("an unparseable components yaml block is a DD-0 finding carrying the parser error", () => {
    const report = domainReport(COMPONENT_FAMILIES, (l) =>
      ComponentCheckMaterials.of({ outcome: parseComponentCatalog("```yaml\na: &x 1\n```\n"), artifact: ap("components.md") }).runChecks(l));
    expect(report.findings().toArray()[0]?.detail).toContain("does not parse in the supported subset");
    expect(report.skippedCount()).toBe(7);
  });

  test("an absent dependency artifact skips CD-1/CD-3 as absent-input", () => {
    const report = domainReport(CONTRACT_FAMILIES, (l) =>
      ContractCheckMaterials.of({
        artifact: ArtifactPath.reconstitute("contract-summary.md"),
        depArtifact: ArtifactPath.reconstitute("unit-of-work-dependency.md"),
        declaredUnits: { kind: "absent" },
        contractsTable: { kind: "absent" },
        specBlocks: SpecBlockAssessments.of([]),
      }).runChecks(l), "contract-summary");
    const reasons = report.skipped().toArray().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:CD-1:absent-input");
    expect(reasons).toContain("check:CD-3:absent-input");
    expect(report.checked().toArray()).toEqual(["check:CD-2"]);
  });

  test("an unusable units edge block and every spec-block issue kind are reported", () => {
    const report = domainReport(CONTRACT_FAMILIES, (l) =>
      ContractCheckMaterials.of({
        artifact: ArtifactPath.reconstitute("contract-summary.md"),
        depArtifact: ArtifactPath.reconstitute("unit-of-work-dependency.md"),
        declaredUnits: { kind: "unrecognized", error: "no yaml fence with a top-level `units:` list" },
        contractsTable: { kind: "rows", rows: ContractRows.of([]) },
        specBlocks: SpecBlockAssessments.of([
          { index: BlockIndex.reconstitute(1), line: LineNumber.reconstitute(1), issue: { kind: "openapi-without-paths" } },
          { index: BlockIndex.reconstitute(2), line: LineNumber.reconstitute(5), issue: { kind: "not-a-mapping" } },
          { index: BlockIndex.reconstitute(3), line: LineNumber.reconstitute(9), issue: { kind: "unparseable", error: "line 1: x" } },
        ]),
      }).runChecks(l), "contract-summary");
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain("CD-2: OpenAPI spec block carries `openapi:` but no `paths:`");
    expect(details).toContain("CD-2: spec block is not a YAML mapping");
    expect(details).toContain("CD-2: spec block does not parse in the supported YAML subset");
    const reasons = report.skipped().toArray().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:CD-1:unrecognized-format");
    expect(reasons).toContain("check:CD-3:unrecognized-format");
  });
});

function functionalInput(overrides: Partial<FunctionalCheckMaterialsSeed>): FunctionalCheckMaterialsSeed {
  return {
    unit: UnitName.reconstitute("u1"),
    entitiesArtifact: ArtifactPath.reconstitute("e.md"),
    entities: { kind: "absent" },
    rulesArtifact: ArtifactPath.reconstitute("r.md"),
    rules: { kind: "absent" },
    specArtifact: ArtifactPath.reconstitute("s.md"),
    spec: { kind: "absent" },
    requirementIdsKnown: null,
    componentsArtifact: ArtifactPath.reconstitute("components.md"),
    domainEntities: { kind: "absent" },
    siblingUnits: SiblingUnitIndex.of(new Map()),
    ...overrides,
  };
}

function functionalReport(overrides: Partial<FunctionalCheckMaterialsSeed>): ReferenceCheckReport {
  const input = functionalInput(overrides);
  return domainReport(FUNCTIONAL_FAMILIES, (l) => FunctionalCheckMaterials.of(input).runChecks(l), "functional-design", input.unit);
}

describe("functional branches the fixtures do not exercise", () => {
  test("an entirely absent functional-design record skips every family it needs", () => {
    const report = functionalReport({ unit: undefined });
    expect(report.findingsCount()).toBe(0);
    expect(report.skippedCount()).toBe(16);
    expect(report.checked().toArray()).toEqual([]);
    expect(report.skipped().toArray().every((s) => s.reason === "absent-input")).toBe(true);
  });

  test("a broken entities fence blocks FD-E2..E6, and broken rules block FD-R2..R5", () => {
    const report = functionalReport({
      entities: parseEntitiesDocument("```yaml\na: &x 1\n```\n"),
      rules: parseRulesDocument("```yaml\nnotrules: 1\n```\n"),
      spec: parseFunctionalSpecDocument("# no machines\n"),
      domainEntities: parseDomainEntitiesDocument("```yaml\nbroken: &x 1\n```\n"),
    });
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain("FD-E1: yaml block does not parse in the supported subset");
    expect(details).toContain("FD-R1: top-level `rules:` list is missing");
    const reasons = report.skipped().toArray().map((s) => `${s.target}:${s.reason}`);
    for (const f of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6", "FD-R2", "FD-R3", "FD-R4", "FD-R5"]) {
      expect(reasons).toContain(`check:${f}:unrecognized-format`);
    }
    expect(reasons).toContain("check:XS-1:unrecognized-format");
  });

  test("wrong fence counts on entities and rules are their own frozen findings", () => {
    const twoFences = "```yaml\na: 1\n```\n```yaml\nb: 2\n```\n";
    const report = functionalReport({
      entities: parseEntitiesDocument(twoFences),
      rules: parseRulesDocument(twoFences),
    });
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain("FD-E1: entities.md must carry exactly one fenced yaml source-of-truth block (found 2)");
    expect(details).toContain("FD-R1: rules.md must carry exactly one fenced yaml source-of-truth block (found 2)");
  });

  test("state machines: unsupported subset, undeclared entity, missing lifecycle attr", () => {
    const entitiesMd = [
      "```yaml",
      "entities:",
      "  - name: Order",
      "    attributes:",
      "      - name: status",
      "        type: string",
      "        allowed_values: [open, closed]",
      "  - name: Free",
      "    attributes:",
      "      - name: note",
      "        type: string",
      "```",
      "",
    ].join("\n");
    const specMd = [
      "## State Machine: Order",
      "```mermaid",
      "stateDiagram-v2",
      "state fork1 <<fork>>",
      "open --> closed",
      "```",
      "## State Machine: Ghost",
      "```mermaid",
      "stateDiagram-v2",
      "a --> b",
      "```",
      "## State Machine: Free",
      "```mermaid",
      "stateDiagram-v2",
      "x --> y",
      "```",
      "",
    ].join("\n");
    const report = functionalReport({
      entities: parseEntitiesDocument(entitiesMd),
      spec: parseFunctionalSpecDocument(specMd),
    });
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain('FD-S1: state machine names entity "Ghost"');
    const reasons = report.skipped().toArray().map((s) => `${s.reason}:${s.detail ?? ""}`).join("\n");
    expect(reasons).toContain("choice/fork/join nodes are outside the supported stateDiagram subset");
    expect(reasons).toContain('no lifecycle attribute with allowed values could be determined for entity "Free"');
  });

  test("duplicate entities/attributes, type-token incoherence, and default violations are findings", () => {
    const md = [
      "```yaml",
      "entities:",
      "  - name: Order",
      "    attributes:",
      "      - name: qty",
      "        type: int",
      "        allowed_values: [a, b]",
      "        unique: true",
      "      - name: qty",
      "        type: string",
      "        min: 1",
      "      - name: tags",
      "        type: list",
      "        unique: true",
      "      - name: kind",
      "        type: string",
      "        allowed_values: [x, y]",
      "        default: z",
      "      - name: level",
      "        type: int",
      "        min: 1",
      "        max: 3",
      "        default: 9",
      "    relationships:",
      "      - to: Ghost",
      "        cardinality: 2:9",
      "  - name: Order",
      "```",
      "",
    ].join("\n");
    const report = functionalReport({ entities: parseEntitiesDocument(md) });
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain('entity "Order" is declared more than once');
    expect(details).toContain('attribute "Order.qty" is declared more than once');
    expect(details).toContain("declares allowed values but its type");
    expect(details).toContain("declares min/max but its type");
    expect(details).toContain("declares unique but its type");
    expect(details).toContain('default "z" is not one of the allowed values');
    expect(details).toContain("default 9 is above max 3");
    expect(details).toContain('relationship endpoint "Ghost" is not a declared entity');
    expect(details).toContain('cardinality "2:9" is not in the closed set');
  });

  test("rule id duplication, bad shape, applies-to fallback, and category set are findings", () => {
    const entitiesMd = "```yaml\nentities:\n  - name: Order\n    attributes:\n      - name: qty\n        type: int\n```\n";
    const rulesMd = [
      "```yaml",
      "rules:",
      "  - id: BR1.1",
      "    statement: s",
      "    category: validation",
      "    source: FR-1",
      "    applies_to: the Order rules",
      "  - id: BR1.1",
      "    statement: s",
      "    category: magic",
      "    source: FR-1",
      "    applies_to: nothing here",
      "  - id: rogue",
      "    statement: s",
      "    category: validation",
      "    source: FR-1",
      "```",
      "",
    ].join("\n");
    const report = functionalReport({
      entities: parseEntitiesDocument(entitiesMd),
      rules: parseRulesDocument(rulesMd),
      requirementIdsKnown: RequirementIds.of(["FR-1"]),
    });
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain('rule id "BR1.1" is declared more than once');
    expect(details).toContain('rule id "rogue" does not match BR{group}.{seq}');
    expect(details).toContain('applies-to "nothing here" does not resolve');
    expect(details).toContain('category "magic" is not one of');
    expect(details).not.toContain('applies-to "the Order rules"');
  });

  test("shape errors, default-below-min, direction-less cardinality, R3/R4 skips, unparseable rules", () => {
    const md = [
      "```yaml",
      "entities:",
      "  - name: Order",
      "    attributes:",
      "      - name: level",
      "        type: int",
      "        min: 5",
      "        default: 1",
      "    relationships:",
      "      - cardinality: 1:N",
      "  - just-a-string",
      "```",
      "",
    ].join("\n");
    const report = functionalReport({
      entities: parseEntitiesDocument(md),
      rules: parseRulesDocument("```yaml\nrules:\n  - id: BR1.1\n    statement: s\n    category: validation\n    source: FR-9\n```\n"),
      spec: parseFunctionalSpecDocument("# prose only\n"),
    });
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain("entity entry is not a mapping");
    expect(details).toContain("default 1 is below min 5");
    expect(details).toContain("relationship declares a cardinality but no direction");
    const reasons = report.skipped().toArray().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:FD-R3:absent-input");

    const broken = functionalReport({ rules: parseRulesDocument("```yaml\nrules: &x 1\n```\n") });
    expect(broken.findings().toArray().map((f) => f.detail).join("\n"))
      .toContain("FD-R1: yaml block does not parse in the supported subset");
    expect(broken.skipped().toArray().map((s) => `${s.target}:${s.reason}`)).toContain("check:FD-R4:unrecognized-format");
  });

  test("a lifecycle entity without any machine gets FD-S skips, and XS-3 reports dropped attributes", () => {
    const entitiesMd = "```yaml\nentities:\n  - name: Order\n    attributes:\n      - name: status\n        type: string\n        allowed_values: [open, closed]\n```\n";
    const componentsMd = "```yaml\ncomponents:\n  - name: Core\n    entities:\n      - name: Order\n        attributes: [status, audit_flag]\n```\n";
    const report = functionalReport({
      entities: parseEntitiesDocument(entitiesMd),
      spec: parseFunctionalSpecDocument("# prose only, no machines\n"),
      domainEntities: parseDomainEntitiesDocument(componentsMd),
      siblingUnits: SiblingUnitIndex.of(new Map([["u1", new Map([["order", { name: EntityName.reconstitute("Order"), attrs: AttributeNames.of([AttributeName.reconstitute("status")]) }]])]])),
    });
    const skipDetails = report.skipped().toArray().map((s) => s.detail ?? "").join("\n");
    expect(skipDetails).toContain('no `### State Machine: Order` heading with a stateDiagram fence found');
    const details = report.findings().toArray().map((f) => f.detail).join("\n");
    expect(details).toContain('domain-design declares attribute(s) audit_flag on "Order"');
  });

  test("XS with extracted components but an undetermined unit skips XS-3 explicitly", () => {
    const componentsMd = "```yaml\ncomponents:\n  - name: Core\n    entities:\n      - name: Order\n        attributes: [qty]\n```\n";
    const report = functionalReport({
      unit: undefined,
      domainEntities: parseDomainEntitiesDocument(componentsMd),
      siblingUnits: SiblingUnitIndex.of(new Map([["u2", new Map([["order", { name: EntityName.reconstitute("Order"), attrs: AttributeNames.of([AttributeName.reconstitute("qty")]) }]])]])),
    });
    const reasons = report.skipped().toArray().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:XS-3:unrecognized-format");
  });

  test("the ledger records findings and skips against their families and derives checked", () => {
    const ledger = CheckFamilyLedger.of(CheckFamilies.reconstitute(["A-1", "A-2", "A-3"]), UnitName.reconstitute("u9"));
    ledger.finding(CheckFamily.reconstitute("A-1"), "structure-invalid", ["check:A-1"], [], "boom");
    ledger.skip(CheckFamily.reconstitute("A-2"), "absent-input", "gone");
    expect(ledger.findings().toArray()[0]?.detail).toBe("A-1: boom");
    expect(ledger.findings().toArray()[0]?.unit).toBe("u9");
    expect(ledger.skipped().toArray()[0]?.target).toBe("check:A-2");
    expect(ledger.skipped().toArray()[0]?.unit).toBe("u9");
    expect(ledger.checkedTargets().toArray()).toEqual(["check:A-3"]);
  });

  test("a degraded conformance still renders a schema-valid unavailable document", () => {
    const bad = domainReport(COMPONENT_FAMILIES, (l) =>
      l.finding(CheckFamily.reconstitute("DD-0"), "no-such-kind", ["check:DD-0"], [], "x"));
    const conformed = conformToContract(bad, schema);
    expect(conformed.isUnavailable()).toBe(true);
    expect(JSON.parse(renderReportBytes(conformed)).unavailable.reason)
      .toStartWith("self-validation against deep-spec-findings-schema.json failed: ");
  });
});
