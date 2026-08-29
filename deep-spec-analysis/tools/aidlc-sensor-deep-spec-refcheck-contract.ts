// deep-spec-refcheck-contract sensor — deterministic reference/structure
// checks for the contract-design summary (contract-summary.md).
//
// Check families (solver-free, LLM-free — phase 1):
//   CD-1  contracts-table rows parse; Provider Unit and Owner are declared
//         units; Consumer is a declared unit or `External: …`
//   CD-2  every fenced yaml spec block parses and carries its family
//         discriminator (openapi:+paths / asyncapi: / shared-schema)
//   CD-3  every inter-unit dependency edge has at least one contracts-table
//         row for that (provider, consumer) pair, in either orientation
//
// 合成ルート（配線のみ）：入力の取得 → アダプタのパーサで型付き入力へ →
// ユースケース（純）→ 契約適合 → Repository.save → verdict。
//
// Sensor contract: parses --stage / --output-path (+ --report-only);
// pass-through on writes that are not contract-summary.md; one JSON verdict
// line on stdout; always exit 0.

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findRecordRoot,
  parseFlags,
  readContractSchema,
  readIfExists,
  relArtifact,
  renderVerdictLine,
} from "./kernel/adapter/index.ts";
import { CheckContractSummaryUseCase } from "./refcheck/usecase/index.ts";
import {
  ReferenceCheckReportRepositoryImpl,
  assessSpecBlocks,
  conformToContract,
  parseContractsTable,
  parseDeclaredUnits,
} from "./refcheck/adapter/index.ts";

const TARGET_BASENAME = "contract-summary.md";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-refcheck-contract: --output-path is required\n");
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
  const depPath = recordRoot === null ? null : join(recordRoot, "inception", "units-generation", "unit-of-work-dependency.md");
  const depMd = depPath === null ? null : readIfExists(depPath);
  const report = new CheckContractSummaryUseCase().execute({
    reportDirectory: join(dirname(flags.outputPath), "deep-spec-refcheck"),
    artifact: relArtifact(recordRoot, flags.outputPath),
    artifactText: md,
    depArtifact: depPath === null ? "unit-of-work-dependency.md" : relArtifact(recordRoot, depPath),
    depText: depMd,
    declaredUnits: parseDeclaredUnits(depMd),
    contractsTable: parseContractsTable(md),
    specBlocks: assessSpecBlocks(md),
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
