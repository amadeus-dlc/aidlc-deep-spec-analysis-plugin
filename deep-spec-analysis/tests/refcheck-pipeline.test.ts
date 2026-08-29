// レイヤード refcheck パイプラインの in-process 検証（PR2b-2、#15）。
//
// 1) golden 同値：broken/clean fixture を entry と同じ取得規則で読み、
//    パーサ → ユースケース → 契約適合 → serializer 描画の全経路を
//    子プロセスなしで走らせ、期待 golden とバイト比較する。CLI spawn の
//    golden テストと合わせ、同一バイトへの経路が 2 本になる。
// 2) skip 分岐の網羅：fixture が踏まない absent/blocked/unsupported 系の
//    分岐を型付き outcome で直接与えて固定する（domain 90% 床の実カバレッジ）。

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requirementIds } from "../tools/kernel/domain/index.ts";
import { readContractSchema, readIfExists, relArtifact } from "../tools/kernel/adapter/index.ts";
import {
  buildSiblingUnitEntities,
  conformToContract,
  parseComponentCatalog,
  parseContractsTable,
  parseDeclaredUnits,
  parseDomainEntitiesDocument,
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
  parseRulesDocument,
  assessSpecBlocks,
  renderReportBytes,
} from "../tools/refcheck/adapter/index.ts";
import {
  CheckContractSummaryUseCase,
  CheckDomainComponentsUseCase,
  CheckFunctionalDesignUseCase,
  type NamedArtifact,
} from "../tools/refcheck/usecase/index.ts";
import { CheckFamilyLedger } from "../tools/refcheck/domain/index.ts";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(pluginRoot, "tests", "fixtures", "refcheck");
const schema = readContractSchema(join(pluginRoot, "tools", "data", "deep-spec-findings-schema.json"));

function golden(variant: string, file: string): string {
  return readFileSync(join(fixtures, "expected", variant, file), "utf-8");
}

describe("in-process golden equivalence (parsers → use case → conform → render)", () => {
  for (const variant of ["broken", "clean"] as const) {
    test(`${variant}: components.md reproduces the golden bytes without a child process`, () => {
      const record = join(fixtures, variant);
      const path = join(record, "inception", "domain-design", "components.md");
      const md = readFileSync(path, "utf-8");
      const report = new CheckDomainComponentsUseCase().execute({
        reportDirectory: join(dirname(path), "deep-spec-refcheck"),
        artifact: relArtifact(record, path),
        artifactText: md,
        catalog: parseComponentCatalog(md),
      });
      expect(renderReportBytes(conformToContract(report, schema))).toBe(golden(variant, "components.json"));
    });

    test(`${variant}: contract-summary.md reproduces the golden bytes without a child process`, () => {
      const record = join(fixtures, variant);
      const path = join(record, "inception", "contract-design", "contract-summary.md");
      const md = readFileSync(path, "utf-8");
      const depPath = join(record, "inception", "units-generation", "unit-of-work-dependency.md");
      const depMd = readIfExists(depPath);
      const report = new CheckContractSummaryUseCase().execute({
        reportDirectory: join(dirname(path), "deep-spec-refcheck"),
        artifact: relArtifact(record, path),
        artifactText: md,
        depArtifact: relArtifact(record, depPath),
        depText: depMd,
        declaredUnits: parseDeclaredUnits(depMd),
        contractsTable: parseContractsTable(md),
        specBlocks: assessSpecBlocks(md),
      });
      expect(renderReportBytes(conformToContract(report, schema))).toBe(golden(variant, "contract-summary.json"));
    });

    test(`${variant}: functional-design reproduces the golden bytes without a child process`, () => {
      const record = join(fixtures, variant);
      const fdDir = join(record, "construction", "u1-orders", "functional-design");
      const rel = (p: string): string => relArtifact(record, p);
      const named = (p: string, text: string | null): NamedArtifact | null =>
        text === null ? null : { artifact: rel(p), text };
      const entitiesPath = join(fdDir, "entities.md");
      const entitiesMd = readIfExists(entitiesPath);
      const rulesPath = join(fdDir, "rules.md");
      const rulesMd = readIfExists(rulesPath);
      const specPath = join(fdDir, "functional-spec.md");
      const specMd = readIfExists(specPath);
      const rulesOutcome = parseRulesDocument(rulesMd);
      const reqPath = join(record, "inception", "requirements-analysis", "requirements.md");
      const reqMd = rulesOutcome.kind === "extracted" ? readIfExists(reqPath) : null;
      const componentsPath = join(record, "inception", "domain-design", "components.md");
      const componentsMd = readIfExists(componentsPath);
      const domainEntities = parseDomainEntitiesDocument(componentsMd);
      const siblingTexts: { unit: string; path: string; text: string }[] = [];
      if (domainEntities.kind === "extracted") {
        for (const u of ["u1-orders", "u2-billing"]) {
          const p = join(record, "construction", u, "functional-design", "entities.md");
          const text = readIfExists(p);
          if (text !== null) siblingTexts.push({ unit: u, path: p, text });
        }
      }
      const report = new CheckFunctionalDesignUseCase().execute({
        reportDirectory: join(fdDir, "deep-spec-refcheck"),
        unit: "u1-orders",
        entitiesArtifact: rel(entitiesPath),
        entitiesDocument: named(entitiesPath, entitiesMd),
        entities: parseEntitiesDocument(entitiesMd),
        rulesArtifact: rel(rulesPath),
        rulesDocument: named(rulesPath, rulesMd),
        rules: rulesOutcome,
        specArtifact: rel(specPath),
        specDocument: named(specPath, specMd),
        spec: parseFunctionalSpecDocument(specMd),
        requirementsDocument: reqMd === null ? null : named(reqPath, reqMd),
        requirementIdsKnown: reqMd === null ? null : requirementIds(reqMd),
        componentsArtifact: rel(componentsPath),
        componentsDocument: named(componentsPath, componentsMd),
        domainEntities,
        siblingUnits: buildSiblingUnitEntities(siblingTexts),
        siblingDocuments: siblingTexts
          .filter((s) => s.path !== entitiesPath)
          .map((s) => ({ artifact: rel(s.path), text: s.text })),
      });
      expect(renderReportBytes(conformToContract(report, schema))).toBe(golden(variant, "functional-design.json"));
    });
  }
});

describe("skip branches the fixtures do not exercise", () => {
  test("a broken components fence blocks DD-1..DD-7 with unrecognized-format skips", () => {
    const report = new CheckDomainComponentsUseCase().execute({
      reportDirectory: "/tmp/r",
      artifact: "components.md",
      artifactText: "no fence at all",
      catalog: parseComponentCatalog("no fence at all"),
    });
    expect(report.findingsCount()).toBe(1);
    expect(report.skippedCount()).toBe(7);
    expect(report.skipped().every((s) => s.reason === "unrecognized-format")).toBe(true);
    expect(report.checked()).toEqual([]);
  });

  test("an unparseable components yaml block is a DD-0 finding carrying the parser error", () => {
    const md = "```yaml\na: &x 1\n```\n";
    const report = new CheckDomainComponentsUseCase().execute({
      reportDirectory: "/tmp/r",
      artifact: "components.md",
      artifactText: md,
      catalog: parseComponentCatalog(md),
    });
    expect(report.findings()[0]?.detail).toContain("does not parse in the supported subset");
    expect(report.skippedCount()).toBe(7);
  });

  test("an absent dependency artifact skips CD-1/CD-3 as absent-input", () => {
    const report = new CheckContractSummaryUseCase().execute({
      reportDirectory: "/tmp/r",
      artifact: "contract-summary.md",
      artifactText: "# empty\n",
      depArtifact: "unit-of-work-dependency.md",
      depText: null,
      declaredUnits: parseDeclaredUnits(null),
      contractsTable: parseContractsTable("# empty\n"),
      specBlocks: assessSpecBlocks("# empty\n"),
    });
    const reasons = report.skipped().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:CD-1:absent-input");
    expect(reasons).toContain("check:CD-3:absent-input");
    expect(report.checked()).toEqual(["check:CD-2"]);
  });

  test("an unusable units edge block and every spec-block issue kind are reported", () => {
    const md = "```yaml\nopenapi: 3.0.0\n```\n```yaml\n- just\n- a list\n```\n```yaml\na: &x 1\n```\n";
    const report = new CheckContractSummaryUseCase().execute({
      reportDirectory: "/tmp/r",
      artifact: "contract-summary.md",
      artifactText: md,
      depArtifact: "unit-of-work-dependency.md",
      depText: "# no edge block\n",
      declaredUnits: parseDeclaredUnits("# no edge block\n"),
      contractsTable: parseContractsTable(md),
      specBlocks: assessSpecBlocks(md),
    });
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain("CD-2: OpenAPI spec block carries `openapi:` but no `paths:`");
    expect(details).toContain("CD-2: spec block is not a YAML mapping");
    expect(details).toContain("CD-2: spec block does not parse in the supported YAML subset");
    const reasons = report.skipped().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:CD-1:unrecognized-format");
    expect(reasons).toContain("check:CD-3:unrecognized-format");
  });

  test("an entirely absent functional-design record skips every family it needs", () => {
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: undefined,
      entitiesArtifact: "entities.md",
      entitiesDocument: null,
      entities: parseEntitiesDocument(null),
      rulesArtifact: "rules.md",
      rulesDocument: null,
      rules: parseRulesDocument(null),
      specArtifact: "functional-spec.md",
      specDocument: null,
      spec: parseFunctionalSpecDocument(null),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: null,
      domainEntities: parseDomainEntitiesDocument(null),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    expect(report.findingsCount()).toBe(0);
    expect(report.skippedCount()).toBe(16);
    expect(report.checked()).toEqual([]);
    expect(report.skipped().every((s) => s.reason === "absent-input")).toBe(true);
  });

  test("a broken entities fence blocks FD-E2..E6, and broken rules block FD-R2..R5", () => {
    const badYaml = "```yaml\na: &x 1\n```\n";
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: badYaml },
      entities: parseEntitiesDocument(badYaml),
      rulesArtifact: "r.md",
      rulesDocument: { artifact: "r.md", text: "```yaml\nnotrules: 1\n```\n" },
      rules: parseRulesDocument("```yaml\nnotrules: 1\n```\n"),
      specArtifact: "s.md",
      specDocument: { artifact: "s.md", text: "# no machines\n" },
      spec: parseFunctionalSpecDocument("# no machines\n"),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: { artifact: "components.md", text: "```yaml\nbroken: &x 1\n```\n" },
      domainEntities: parseDomainEntitiesDocument("```yaml\nbroken: &x 1\n```\n"),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain("FD-E1: yaml block does not parse in the supported subset");
    expect(details).toContain("FD-R1: top-level `rules:` list is missing");
    const reasons = report.skipped().map((s) => `${s.target}:${s.reason}`);
    for (const f of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6", "FD-R2", "FD-R3", "FD-R4", "FD-R5"]) {
      expect(reasons).toContain(`check:${f}:unrecognized-format`);
    }
    expect(reasons).toContain("check:XS-1:unrecognized-format");
  });

  test("wrong fence counts on entities and rules are their own frozen findings", () => {
    const twoFences = "```yaml\na: 1\n```\n```yaml\nb: 2\n```\n";
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: twoFences },
      entities: parseEntitiesDocument(twoFences),
      rulesArtifact: "r.md",
      rulesDocument: { artifact: "r.md", text: twoFences },
      rules: parseRulesDocument(twoFences),
      specArtifact: "s.md",
      specDocument: null,
      spec: parseFunctionalSpecDocument(null),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: null,
      domainEntities: parseDomainEntitiesDocument(null),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain("FD-E1: entities.md must carry exactly one fenced yaml source-of-truth block (found 2)");
    expect(details).toContain("FD-R1: rules.md must carry exactly one fenced yaml source-of-truth block (found 2)");
  });

  test("state machines: unsupported subset, undeclared entity, missing lifecycle attr, and no-machine lifecycle skips", () => {
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
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: entitiesMd },
      entities: parseEntitiesDocument(entitiesMd),
      rulesArtifact: "r.md",
      rulesDocument: null,
      rules: parseRulesDocument(null),
      specArtifact: "s.md",
      specDocument: { artifact: "s.md", text: specMd },
      spec: parseFunctionalSpecDocument(specMd),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: null,
      domainEntities: parseDomainEntitiesDocument(null),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain('FD-S1: state machine names entity "Ghost"');
    const reasons = report.skipped().map((s) => `${s.reason}:${s.detail ?? ""}`).join("\n");
    expect(reasons).toContain("choice/fork/join nodes are outside the supported stateDiagram subset");
    expect(reasons).toContain('no lifecycle attribute with allowed values could be determined for entity "Free"');
  });

  test("the ledger records findings and skips against their families and derives checked", () => {
    const ledger = new CheckFamilyLedger(["A-1", "A-2", "A-3"], "u9");
    ledger.finding("A-1", "structure-invalid", ["check:A-1"], [], "boom");
    ledger.skip("A-2", "absent-input", "gone");
    expect(ledger.findings()[0]?.detail).toBe("A-1: boom");
    expect(ledger.findings()[0]?.unit).toBe("u9");
    expect(ledger.skipped()[0]?.target).toBe("check:A-2");
    expect(ledger.skipped()[0]?.unit).toBe("u9");
    expect(ledger.checkedTargets()).toEqual(["check:A-3"]);
  });
});

describe("remaining functional-check branches (coverage floor)", () => {
  const base = {
    reportDirectory: "/tmp/r",
    rulesArtifact: "r.md",
    specArtifact: "s.md",
    specDocument: null,
    spec: parseFunctionalSpecDocument(null),
    requirementsDocument: null,
    componentsArtifact: "components.md",
    componentsDocument: null,
    domainEntities: parseDomainEntitiesDocument(null),
    siblingUnits: new Map<string, Map<string, { name: string; attrs: string[] }>>(),
    siblingDocuments: [] as NamedArtifact[],
  };

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
    const report = new CheckFunctionalDesignUseCase().execute({
      ...base,
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: md },
      entities: parseEntitiesDocument(md),
      rulesDocument: null,
      rules: parseRulesDocument(null),
      requirementIdsKnown: null,
    });
    const details = report.findings().map((f) => f.detail).join("\n");
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
    const entitiesMd = [
      "```yaml",
      "entities:",
      "  - name: Order",
      "    attributes:",
      "      - name: qty",
      "        type: int",
      "```",
      "",
    ].join("\n");
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
    const report = new CheckFunctionalDesignUseCase().execute({
      ...base,
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: entitiesMd },
      entities: parseEntitiesDocument(entitiesMd),
      rulesDocument: { artifact: "r.md", text: rulesMd },
      rules: parseRulesDocument(rulesMd),
      requirementIdsKnown: new Set(["FR-1"]),
    });
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain('rule id "BR1.1" is declared more than once');
    expect(details).toContain('rule id "rogue" does not match BR{group}.{seq}');
    expect(details).toContain('applies-to "nothing here" does not resolve');
    expect(details).toContain('category "magic" is not one of');
    expect(details).not.toContain('applies-to "the Order rules"');
  });

  test("XS with extracted components but an undetermined unit skips XS-3 explicitly", () => {
    const componentsMd = [
      "```yaml",
      "components:",
      "  - name: Core",
      "    entities:",
      "      - name: Order",
      "        attributes: [qty]",
      "```",
      "",
    ].join("\n");
    const sibling = new Map([["u2", new Map([["order", { name: "Order", attrs: ["qty"] }]])]]);
    const report = new CheckFunctionalDesignUseCase().execute({
      ...base,
      unit: undefined,
      entitiesArtifact: "e.md",
      entitiesDocument: null,
      entities: parseEntitiesDocument(null),
      rulesDocument: null,
      rules: parseRulesDocument(null),
      requirementIdsKnown: null,
      componentsDocument: { artifact: "components.md", text: componentsMd },
      domainEntities: parseDomainEntitiesDocument(componentsMd),
      siblingUnits: sibling,
    });
    const reasons = report.skipped().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:XS-3:unrecognized-format");
    expect(report.findings().map((f) => f.detail).join("\n")).not.toContain("XS-2");
  });
});

describe("last functional branches (coverage floor)", () => {
  test("shape errors, default-below-min, and direction-less cardinality are findings", () => {
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
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: md },
      entities: parseEntitiesDocument(md),
      rulesArtifact: "r.md",
      rulesDocument: null,
      rules: parseRulesDocument(null),
      specArtifact: "s.md",
      specDocument: { artifact: "s.md", text: "# prose only\n" },
      spec: parseFunctionalSpecDocument("# prose only\n"),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: null,
      domainEntities: parseDomainEntitiesDocument(null),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain("entity entry is not a mapping");
    expect(details).toContain("default 1 is below min 5");
    expect(details).toContain("relationship declares a cardinality but no direction");
  });

  test("unparseable rules yaml, R3 absent-requirements skip, and R4 absent-entities skip", () => {
    const rulesMd = [
      "```yaml",
      "rules:",
      "  - id: BR1.1",
      "    statement: s",
      "    category: validation",
      "    source: FR-9",
      "```",
      "",
    ].join("\n");
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: null,
      entities: parseEntitiesDocument(null),
      rulesArtifact: "r.md",
      rulesDocument: { artifact: "r.md", text: rulesMd },
      rules: parseRulesDocument(rulesMd),
      specArtifact: "s.md",
      specDocument: null,
      spec: parseFunctionalSpecDocument(null),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: null,
      domainEntities: parseDomainEntitiesDocument(null),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    const reasons = report.skipped().map((s) => `${s.target}:${s.reason}`);
    expect(reasons).toContain("check:FD-R3:absent-input");
    expect(reasons).toContain("check:FD-R4:absent-input");

    const badRules = "```yaml\nrules: &x 1\n```\n";
    const broken = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: null,
      entities: parseEntitiesDocument(null),
      rulesArtifact: "r.md",
      rulesDocument: { artifact: "r.md", text: badRules },
      rules: parseRulesDocument(badRules),
      specArtifact: "s.md",
      specDocument: null,
      spec: parseFunctionalSpecDocument(null),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: null,
      domainEntities: parseDomainEntitiesDocument(null),
      siblingUnits: new Map(),
      siblingDocuments: [],
    });
    expect(broken.findings().map((f) => f.detail).join("\n"))
      .toContain("FD-R1: yaml block does not parse in the supported subset");
  });

  test("a lifecycle entity without any state machine gets FD-S1/S2 skips, and XS-3 reports dropped attributes", () => {
    const entitiesMd = [
      "```yaml",
      "entities:",
      "  - name: Order",
      "    attributes:",
      "      - name: status",
      "        type: string",
      "        allowed_values: [open, closed]",
      "```",
      "",
    ].join("\n");
    const componentsMd = [
      "```yaml",
      "components:",
      "  - name: Core",
      "    entities:",
      "      - name: Order",
      "        attributes: [status, audit_flag]",
      "```",
      "",
    ].join("\n");
    const report = new CheckFunctionalDesignUseCase().execute({
      reportDirectory: "/tmp/r",
      unit: "u1",
      entitiesArtifact: "e.md",
      entitiesDocument: { artifact: "e.md", text: entitiesMd },
      entities: parseEntitiesDocument(entitiesMd),
      rulesArtifact: "r.md",
      rulesDocument: null,
      rules: parseRulesDocument(null),
      specArtifact: "s.md",
      specDocument: { artifact: "s.md", text: "# prose only, no machines\n" },
      spec: parseFunctionalSpecDocument("# prose only, no machines\n"),
      requirementsDocument: null,
      requirementIdsKnown: null,
      componentsArtifact: "components.md",
      componentsDocument: { artifact: "components.md", text: componentsMd },
      domainEntities: parseDomainEntitiesDocument(componentsMd),
      siblingUnits: new Map([["u1", new Map([["order", { name: "Order", attrs: ["status"] }]])]]),
      siblingDocuments: [],
    });
    const skipDetails = report.skipped().map((s) => s.detail ?? "").join("\n");
    expect(skipDetails).toContain('no `### State Machine: Order` heading with a stateDiagram fence found');
    const details = report.findings().map((f) => f.detail).join("\n");
    expect(details).toContain('domain-design declares attribute(s) audit_flag on "Order"');
  });
});
