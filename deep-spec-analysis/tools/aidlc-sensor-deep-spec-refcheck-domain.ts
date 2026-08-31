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
// 合成ルート（配線のみ）：ユースケースが Repository を保持し、execute が
// 成果物パス（識別）から集約を解決して検査〜永続化までを起動する。
//
// Sensor contract: parses --stage / --output-path (+ --report-only for the
// doctor: compute and report, write nothing); pass-through on writes that are
// not components.md; one JSON verdict line on stdout; always exit 0.

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags, renderVerdictLine } from "./kernel/adapter/index.ts";
import { ArtifactPath } from "./kernel/domain/index.ts";
import { DesignRecordId } from "./refcheck/domain/index.ts";
import { CheckDomainComponentsUseCase } from "./refcheck/usecase/index.ts";
import { DesignRecordRepositoryImpl, ReferenceCheckReportRepositoryImpl } from "./refcheck/adapter/index.ts";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), "deep-spec-refcheck"));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-refcheck-domain: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== "components.md") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  // Repository と Conformance は同一アダプタ（store が書く姿と conformedOf が
  // 常に一致する）。
  const reportRepository = new ReferenceCheckReportRepositoryImpl(
    join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"),
  );
  const useCase = new CheckDomainComponentsUseCase(new DesignRecordRepositoryImpl(), reportRepository, reportRepository);
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
