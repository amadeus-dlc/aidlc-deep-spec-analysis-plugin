// deep-spec-design-verify-smt sensor — SMT backend for the design IR
// (contract 3, method: exhaustive).
//
// COMPILE-DOWN REUSE: each unit of the design IR is lowered to a contract-1
// document and the PROVEN v1 SMT backend is executed on it as a child
// process; findings come back remapped into design vocabulary. Phase 3
// (refinement against the verified requirements IR) rides the same v1 z3
// child through the explicit second SMT compiler.
//
// 合成ルート（配線のみ）：ユースケースが Repository / Client / Clock を保持し、
// execute が成果物パス（識別）から集約を解決して Phase 1-3〜永続化〜クロス
// チェック再計算までを起動する。env（SMT タイムアウト・ランタイム上書き）と
// 自ディレクトリ・スキーマパス・作業ディレクトリはここで解決して注入する。

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlags } from "./kernel/adapter/index.ts";
import { ArtifactPath } from "./kernel/domain/index.ts";
import { DesignModelId } from "./design/domain/index.ts";
import { SystemClock } from "./kernel/adapter/index.ts";
import { VerifyDesignSmtUseCase } from "./design/usecase/index.ts";
import {
  DesignModelRepositoryImpl,
  DesignReportRepositoryImpl,
  RefinementContextRepositoryImpl,
  RefinementSolverClientImpl,
  SiblingBackendClientImpl,
} from "./design/adapter/index.ts";

const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
const DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), DESIGN_VERIFY_DIRNAME));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-design-verify-smt: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== DESIGN_MODEL_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  const toolsDir = dirname(fileURLToPath(import.meta.url));
  const useCase = new VerifyDesignSmtUseCase(
    new DesignModelRepositoryImpl(),
    new DesignReportRepositoryImpl(join(toolsDir, "data", "deep-spec-findings-schema.json")),
    new SiblingBackendClientImpl({ toolsDirectory: toolsDir, workingDirectory: process.cwd() }),
    new RefinementContextRepositoryImpl(join(toolsDir, "data", "deep-spec-refinement-map-schema.json")),
    new RefinementSolverClientImpl({
      childHostPath: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
      perQueryTimeoutMs: Number(process.env.AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS) || 2000,
      runtimeOverride: process.env.AIDLC_DEEP_SPEC_SMT_RUNTIME,
      workingDirectory: process.cwd(),
    }),
    new SystemClock(),
  );
  const outcome = useCase.execute({
    modelId: DesignModelId.of(target.value),
    verifyDirectory: reportLocation.value,
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
      process.stderr.write(`deep-spec-design-verify-smt: ${outcome.error.path}: ${outcome.error.kind}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`);
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
