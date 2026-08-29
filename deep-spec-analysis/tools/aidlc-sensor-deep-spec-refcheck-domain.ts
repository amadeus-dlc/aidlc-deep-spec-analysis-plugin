// deep-spec-refcheck-domain sensor — deterministic reference/structure checks
// for the domain-design component catalogue (components.md).
//
// Check families (all solver-free, LLM-free — phase 1):
//   DD-0  exactly one fenced yaml block, parseable, with the documented shape
//   DD-1  component names PascalCase and unique
//   DD-2  every referenced component (depends_on / dependents / owned_by) declared
//   DD-3  no component depends on itself
//   DD-4  depends_on / dependents symmetry
//   DD-5  every entity owned by exactly one component, with an identifier
//   DD-6  every references.entity declared under its stated owned_by component
//   DD-7  the depends_on graph is acyclic
//
// 合成ルート（配線のみ）：入力の取得（ファイル読み）→ アダプタのパーサで
// 型付き入力へ → ユースケース（純）→ 契約適合 → Repository.save → verdict。
// 検査本体は refcheck/domain、形式知識は refcheck/adapter が持つ。
//
// Sensor contract: parses --stage / --output-path (+ --report-only for the
// doctor: compute and report, write nothing); pass-through on writes that are
// not components.md; one JSON verdict line on stdout; always exit 0.

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findRecordRoot,
  parseFlags,
  readContractSchema,
  relArtifact,
  renderVerdictLine,
} from "./kernel/adapter/index.ts";
import { CheckDomainComponentsUseCase } from "./refcheck/usecase/index.ts";
import {
  ReferenceCheckReportRepositoryImpl,
  conformToContract,
  parseComponentCatalog,
} from "./refcheck/adapter/index.ts";

const TARGET_BASENAME = "components.md";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-refcheck-domain: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== TARGET_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  let md: string;
  try {
    md = readFileSync(flags.outputPath, "utf-8");
  } catch {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const recordRoot = findRecordRoot(dirname(flags.outputPath));
  const report = new CheckDomainComponentsUseCase().execute({
    reportDirectory: join(dirname(flags.outputPath), "deep-spec-refcheck"),
    artifact: relArtifact(recordRoot, flags.outputPath),
    artifactText: md,
    catalog: parseComponentCatalog(md),
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
