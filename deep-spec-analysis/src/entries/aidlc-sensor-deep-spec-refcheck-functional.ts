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
// 合成ルート（配線のみ）：ユースケースが Repository を保持し、execute が
// 成果物パス（識別）から集約を解決して検査〜永続化までを起動する。凍結された
// 取得規則（requirements は rules が使えるときだけ・兄弟は catalog が解析
// できたときだけ）は DesignRecordRepositoryImpl が実装する。
//
// Sensor contract: parses --stage / --output-path (+ --report-only);
// pass-through on writes outside a functional-design directory; one JSON
// verdict line on stdout; always exit 0.

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags, readContractSchema, renderVerdictLine } from "@deep-spec/kernel-adapter";
import { ArtifactPath, FindingsSchema } from "@deep-spec/kernel-domain";
import { DesignRecordId } from "@deep-spec/refcheck-domain";
import { CheckFunctionalDesignUseCase } from "@deep-spec/refcheck-usecase";
import { DesignRecordRepositoryImpl, ReferenceCheckReportRepositoryImpl } from "@deep-spec/refcheck-adapter";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), "deep-spec-refcheck"));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-refcheck-functional: --output-path is required\n");
    process.exit(1);
  }
  const fdDir = dirname(flags.outputPath);
  if (basename(fdDir) !== "functional-design" || !flags.outputPath.endsWith(".md")) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  // 契約2 のスキーマは合成ルートが一度だけ読む。読めなければ「読めなかった」
  // 変種として値に載せ、以後の適合判定はこの 1 つの値からだけ導く（usecase が
  // 保存前に一度だけ conformedTo を通す。BR1.1）。
  const findingsSchemaFile = readContractSchema(join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"));
  const findingsSchema = findingsSchemaFile.ok
    ? FindingsSchema.of(findingsSchemaFile.value)
    : FindingsSchema.unreadable(findingsSchemaFile.error.cause);
  const reportRepository = new ReferenceCheckReportRepositoryImpl();
  const useCase = new CheckFunctionalDesignUseCase(new DesignRecordRepositoryImpl(), reportRepository, findingsSchema);
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
