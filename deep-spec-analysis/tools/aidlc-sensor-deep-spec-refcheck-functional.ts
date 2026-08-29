// deep-spec-refcheck-functional sensor — deterministic reference/structure
// checks for a unit's functional-design record (entities.md / rules.md /
// functional-spec.md) plus the cross-artifact XS checks against domain-design.
//
// Check families (solver-free, LLM-free — phase 1):
//   FD-E1..E6  entities.md shape, type/range/default coherence, relationships
//   FD-R1..R5  rules.md shape, BR ids, FR sources, applies-to, category
//   FD-S1..S2  functional-spec.md state machines ↔ entities allowed values
//   XS-1..XS-3 domain-design entities vs unit entities (ownership, drops, drift)
//
// 合成ルート（配線のみ）：入力の取得（凍結された条件取得——requirements は
// rules が使えるときだけ・兄弟ユニットは components が解析できたときだけ）→
// アダプタのパーサで型付き入力へ → ユースケース（純）→ 契約適合 →
// Repository.save → verdict。
//
// Sensor contract: parses --stage / --output-path (+ --report-only);
// pass-through on writes outside a functional-design directory; one JSON
// verdict line on stdout; always exit 0.

import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requirementIds } from "./kernel/domain/index.ts";
import {
  findRecordRoot,
  listSubdirectories,
  parseFlags,
  readContractSchema,
  readIfExists,
  relArtifact,
  renderVerdictLine,
} from "./kernel/adapter/index.ts";
import { CheckFunctionalDesignUseCase, type NamedArtifact } from "./refcheck/usecase/index.ts";
import {
  ReferenceCheckReportRepositoryImpl,
  buildSiblingUnitEntities,
  conformToContract,
  parseDomainEntitiesDocument,
  parseEntitiesDocument,
  parseFunctionalSpecDocument,
  parseRulesDocument,
} from "./refcheck/adapter/index.ts";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-refcheck-functional: --output-path is required\n");
    process.exit(1);
  }
  const fdDir = dirname(flags.outputPath);
  if (basename(fdDir) !== "functional-design" || !flags.outputPath.endsWith(".md") || !existsSync(fdDir)) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const recordRoot = findRecordRoot(fdDir);
  const unitDir = dirname(fdDir);
  const unit = recordRoot !== null && basename(unitDir) !== "construction" && unitDir !== recordRoot ? basename(unitDir) : undefined;
  const rel = (p: string): string => relArtifact(recordRoot, p);
  const named = (path: string, text: string | null): NamedArtifact | null =>
    text === null ? null : { artifact: rel(path), text };

  // 三点セット（存在すれば読む）
  const entitiesPath = join(fdDir, "entities.md");
  const entitiesMd = readIfExists(entitiesPath);
  const rulesPath = join(fdDir, "rules.md");
  const rulesMd = readIfExists(rulesPath);
  const specPath = join(fdDir, "functional-spec.md");
  const specMd = readIfExists(specPath);
  const rulesOutcome = parseRulesDocument(rulesMd);

  // requirements.md は rules が使えるときだけ読む（凍結された取得条件）
  const reqPath = recordRoot === null ? null : join(recordRoot, "inception", "requirements-analysis", "requirements.md");
  const reqMd = rulesOutcome.kind === "extracted" && reqPath !== null ? readIfExists(reqPath) : null;

  // components.md（XS）と、その解析が成功したときだけ兄弟ユニットを読む
  const componentsPath = recordRoot === null ? null : join(recordRoot, "inception", "domain-design", "components.md");
  const componentsMd = componentsPath === null ? null : readIfExists(componentsPath);
  const domainEntities = parseDomainEntitiesDocument(componentsMd);
  const siblingTexts: { unit: string; path: string; text: string }[] = [];
  if (domainEntities.kind === "extracted" && recordRoot !== null) {
    const constructionDir = join(recordRoot, "construction");
    for (const u of listSubdirectories(constructionDir)) {
      const p = join(constructionDir, u, "functional-design", "entities.md");
      const text = readIfExists(p);
      if (text !== null) siblingTexts.push({ unit: u, path: p, text });
    }
  }

  const report = new CheckFunctionalDesignUseCase().execute({
    reportDirectory: join(fdDir, "deep-spec-refcheck"),
    unit,
    entitiesArtifact: rel(entitiesPath),
    entitiesDocument: named(entitiesPath, entitiesMd),
    entities: parseEntitiesDocument(entitiesMd),
    rulesArtifact: rel(rulesPath),
    rulesDocument: named(rulesPath, rulesMd),
    rules: rulesOutcome,
    specArtifact: rel(specPath),
    specDocument: named(specPath, specMd),
    spec: parseFunctionalSpecDocument(specMd),
    requirementsDocument: reqPath === null ? null : named(reqPath, reqMd),
    requirementIdsKnown: reqMd === null ? null : requirementIds(reqMd),
    componentsArtifact: componentsPath === null ? "components.md" : rel(componentsPath),
    componentsDocument: componentsPath === null ? null : named(componentsPath, componentsMd),
    domainEntities,
    siblingUnits: buildSiblingUnitEntities(siblingTexts),
    siblingDocuments: siblingTexts
      .filter((s) => s.path !== entitiesPath)
      .map((s) => ({ artifact: rel(s.path), text: s.text })),
  });
  const conformed = conformToContract(report, readContractSchema(
    join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"),
  ));
  if (!flags.reportOnly) {
    const saved = new ReferenceCheckReportRepositoryImpl().save(conformed);
    if (!saved.ok) {
      process.stderr.write(`deep-spec-refcheck: failed to write ${saved.error.path}: ${saved.error.kind}${"cause" in saved.error ? ` (${saved.error.cause})` : ""}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(renderVerdictLine(conformed.passes(), conformed.findingsCount(),
    conformed.skippedCount(), flags.reportOnly ? "report-only" : undefined));
  process.exit(0);
}

main();
