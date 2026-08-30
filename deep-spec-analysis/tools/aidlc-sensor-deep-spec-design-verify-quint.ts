// deep-spec-design-verify-quint sensor — Quint backend for the design IR
// (contract 3, method: bounded | simulation).
//
// COMPILE-DOWN REUSE: each unit is lowered to a contract-1 document and the
// PROVEN v1 Quint backend runs on it as a child process; findings come back
// remapped into design vocabulary. Bounded-mode unreachable-state probes are
// budget-capped (AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP, default 2). Phase 3
// (dynamic refinement): alpha(P) joins the machine's invariant surface.
//
// 合成ルート（配線のみ）：ユースケースが Repository / Client / Clock を保持し、
// execute が成果物パス（識別）から集約を解決して Phase 1-3〜永続化〜クロス
// チェック再計算までを起動する。env（プローブ上限）と自ディレクトリ・
// スキーマパス・作業ディレクトリはここで解決して注入する。

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags } from "./kernel/adapter/index.ts";
import { SystemClock } from "./kernel/adapter/index.ts";
import { VerifyDesignQuintUseCase } from "./design/usecase/index.ts";
import {
  DesignModelRepositoryImpl,
  DesignReportRepositoryImpl,
  RefinementContextRepositoryImpl,
  SiblingBackendClientImpl,
} from "./design/adapter/index.ts";

const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
const DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-verify-quint: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== DESIGN_MODEL_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  const toolsDir = dirname(fileURLToPath(import.meta.url));
  const useCase = new VerifyDesignQuintUseCase(
    new DesignModelRepositoryImpl(),
    new DesignReportRepositoryImpl(join(toolsDir, "data", "deep-spec-findings-schema.json")),
    new SiblingBackendClientImpl({ toolsDirectory: toolsDir, workingDirectory: process.cwd() }),
    new RefinementContextRepositoryImpl(join(toolsDir, "data", "deep-spec-refinement-map-schema.json")),
    new SystemClock(),
    Number(process.env.AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP) || 2,
  );
  const outcome = useCase.execute({
    modelPath: flags.outputPath,
    verifyDirectory: join(dirname(flags.outputPath), DESIGN_VERIFY_DIRNAME),
  });

  switch (outcome.kind) {
    case "not-applicable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
      process.exit(0);
      break;
    case "model-unreadable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "ir-unreadable" })}\n`);
      process.exit(0);
      break;
    case "version-mismatch":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: outcome.skippedCount, note: "ir-version-mismatch" })}\n`);
      process.exit(0);
      break;
    case "backend-unavailable":
      // 127 = tool-unavailable to the dispatcher; the findings file already
      // records the degradation for the stage.
      process.exit(127);
      break;
    case "acquisition-failed":
    case "save-failed":
      process.stderr.write(`deep-spec-design-verify-quint: ${outcome.error.path}: ${outcome.error.kind}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`);
      process.exit(1);
      break;
    case "verified":
      process.stdout.write(
        `${JSON.stringify({ pass: outcome.pass, findings_count: outcome.findingsCount, skipped_count: outcome.skippedCount, method: outcome.method })}\n`,
      );
      process.exit(0);
      break;
  }
}

main();
