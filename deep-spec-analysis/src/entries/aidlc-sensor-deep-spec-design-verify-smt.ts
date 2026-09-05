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
import { DirectoryFinalizationLock, parseFlags, readFindingsSchema } from "@deep-spec/kernel-adapter";
import { ArtifactPath, } from "@deep-spec/kernel-domain";
import { DesignModelIdentifier } from "@deep-spec/design-domain";
import { SystemClock } from "@deep-spec/kernel-adapter";
import { VerifyDesignSatisfiabilityModuloTheoriesUseCase } from "@deep-spec/design-usecase";
import {
  DesignModelRepositoryImplementation,
  DesignVerifyDirectoryRepositoryImplementation,
  RefinementMaterialsRepositoryImplementation,
  RefinementSolverClientImplementation,
  SiblingBackendClientImplementation,
} from "@deep-spec/design-adapter";

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
  // 契約2 のスキーマは合成ルートが一度だけ読む。読めなければ「読めなかった」
  // 変種として値に載せ、以後の適合判定はこの 1 つの値からだけ導く（BR1.1）。
  const findingsSchema = readFindingsSchema(join(toolsDir, "data", "deep-spec-findings-schema.json"));
  const useCase = new VerifyDesignSatisfiabilityModuloTheoriesUseCase(
    new DesignModelRepositoryImplementation(),
    new DesignVerifyDirectoryRepositoryImplementation(
      // finalization の directory lock は「実時計」と「実 PID／OS liveness
      // probe」を要る。process.* は合成ルートだけが触れてよいので、ここで
      // 組み立てて注入する（ESRCH=不在確定、EPERM=存在確定、他は不明）。
      new DirectoryFinalizationLock(new SystemClock(), {
        self: () => process.pid,
        statusOf: (pid: number) => {
          try {
            process.kill(pid, 0);
            return "alive";
          } catch (e) {
            const code = (e as { code?: string }).code;
            if (code === "ESRCH") return "absent";
            if (code === "EPERM") return "alive";
            return "unknown";
          }
        },
      }),
    ),
    findingsSchema,
    new SiblingBackendClientImplementation({
      siblingToolPaths: {
        smt: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
        quint: join(toolsDir, "aidlc-sensor-deep-spec-verify-quint.ts"),
      },
      workingDirectory: process.cwd(),
    }),
    new RefinementMaterialsRepositoryImplementation(join(toolsDir, "data", "deep-spec-refinement-map-schema.json")),
    new RefinementSolverClientImplementation({
      childHostPath: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
      perQueryTimeoutMs: Number(process.env.AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS) || 2000,
      runtimeOverride: process.env.AIDLC_DEEP_SPEC_SMT_RUNTIME,
      workingDirectory: process.cwd(),
    }),
    new SystemClock(),
  );
  const outcome = useCase.execute({
    modelId: DesignModelIdentifier.of(target.value),
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
