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
// 合成ルート（配線のみ）：ユースケースが Repository を保持し、execute が
// 成果物パス（識別）から集約を解決して検査〜永続化までを起動する。
//
// Sensor contract: parses --stage / --output-path (+ --report-only);
// pass-through on writes that are not contract-summary.md; one JSON verdict
// line on stdout; always exit 0.

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags, renderVerdictLine } from "@deep-spec/kernel-adapter";
import { ArtifactPath } from "@deep-spec/kernel-domain";
import { DesignRecordId } from "@deep-spec/refcheck-domain";
import { CheckContractSummaryUseCase } from "@deep-spec/refcheck-usecase";
import { DesignRecordRepositoryImpl, ReferenceCheckReportRepositoryImpl } from "@deep-spec/refcheck-adapter";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), "deep-spec-refcheck"));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-refcheck-contract: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== "contract-summary.md") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  // Repository の conformedOf は store が書く姿と
  // 常に一致する）。
  const reportRepository = new ReferenceCheckReportRepositoryImpl(
    join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"),
  );
  const useCase = new CheckContractSummaryUseCase(new DesignRecordRepositoryImpl(), reportRepository);
  const outcome = useCase.execute({
    recordId: DesignRecordId.of(target.value),
    reportDirectory: reportLocation.value,
    mode: flags.reportOnly ? "report-only" : "persist",
  });

  if (outcome.kind === "not-applicable") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  if (outcome.kind === "save-failed") {
    process.stderr.write(`deep-spec-refcheck: failed to write ${outcome.error.path}: ${outcome.error.kind}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`);
    process.exit(1);
  }
  process.stdout.write(renderVerdictLine(outcome.pass, outcome.findingsCount, outcome.skippedCount,
    flags.reportOnly ? "report-only" : undefined));
  process.exit(0);
}

main();
