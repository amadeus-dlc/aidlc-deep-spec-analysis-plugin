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
import {
  DesignModelRepositoryImplementation,
  DesignVerifyDirectoryRepositoryImplementation,
  RefinementMaterialsRepositoryImplementation,
  SiblingBackendClientImplementation,
} from "@deep-spec/design-adapter";
import { DesignModelIdentifier } from "@deep-spec/design-domain";
import { VerifyDesignQuintUseCase } from "@deep-spec/design-usecase";
import { DirectoryFinalizationLock, parseFlags, readFindingsSchema, SystemClock } from "@deep-spec/kernel-adapter";
import { ArtifactPath } from "@deep-spec/kernel-domain";

const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
const DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), DESIGN_VERIFY_DIRNAME));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-design-verify-quint: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== DESIGN_MODEL_BASENAME) {
    process.stdout.write(
      `${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`,
    );
    process.exit(0);
  }
  const toolsDir = dirname(fileURLToPath(import.meta.url));
  // 契約2 のスキーマは合成ルートが一度だけ読む。読めなければ「読めなかった」
  // 変種として値に載せ、以後の適合判定はこの 1 つの値からだけ導く（BR1.1）。
  const findingsSchema = readFindingsSchema(join(toolsDir, "data", "deep-spec-findings-schema.json"));
  const useCase = new VerifyDesignQuintUseCase(
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
    new SystemClock(),
    Number(process.env.AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP) || 2,
  );
  const outcome = useCase.execute({
    modelId: DesignModelIdentifier.of(target.value),
    verifyDirectory: reportLocation.value,
  });

  switch (outcome.kind) {
    case "not-applicable":
      process.stdout.write(
        `${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`,
      );
      process.exit(0);
      break;
    case "model-unreadable":
      process.stdout.write(
        `${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "ir-unreadable" })}\n`,
      );
      process.exit(0);
      break;
    case "version-mismatch":
      process.stdout.write(
        `${JSON.stringify({ pass: true, findings_count: 0, skipped_count: outcome.report.skippedCount(), note: "ir-version-mismatch" })}\n`,
      );
      process.exit(0);
      break;
    case "backend-unavailable":
      // 127 = tool-unavailable to the dispatcher; the findings file already
      // records the degradation for the stage.
      process.exit(127);
      break;
    case "acquisition-failed":
    case "save-failed":
      process.stderr.write(
        `deep-spec-design-verify-quint: ${outcome.error.path}: ${outcome.error.kind}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`,
      );
      process.exit(1);
      break;
    case "verified": {
      const report = outcome.directory.publishedReport();
      process.stdout.write(
        `${JSON.stringify({ pass: report.passes(), findings_count: report.findingsCount(), skipped_count: report.skippedCount(), method: report.method() })}\n`,
      );
      process.exit(0);
      break;
    }
  }
}

main();
