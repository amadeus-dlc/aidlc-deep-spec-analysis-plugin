// deep-spec-verify-quint sensor — Quint backend (state machines).
//
// Deterministically compiles the deep-spec IR (contract 1) to Quint in
// TypeScript, shells out to the `quint` CLI, and writes normalized findings
// (contract 2) to <dirname(output)>/deep-spec-verify/quint.json.
//
// Coverage (natures: state-temporal, plus events with a bounded state
// schema): invariant preservation under the event machine (reachable
// violations => kind: conflict with a step trace witness), deadlocked legal
// states (kind: completeness-gap), leads-to temporal obligations (bounded
// mode only), and fully-bound event-free scenarios (the cross-check surface
// shared with the SMT backend).
//
// Method (FR7.3): `quint verify` (Apalache, method: bounded) when Java and
// an Apalache distribution are detected; otherwise `quint run` with a fixed
// seed (method: simulation). Override with
// AIDLC_DEEP_SPEC_QUINT_METHOD=auto|bounded|simulation.
//
// 合成ルート（配線のみ）：ユースケースが Repository / Client を保持し、
// execute が成果物パス（識別）から形式モデルを解決して検証〜永続化〜
// クロスチェック再計算までを起動する。env（quint バイナリ・method 上書き・
// APALACHE_DIST・HOME）とスキーマパスはここで解決して注入する。
// quint CLI 不在は unavailable 文書へ降格して exit 127。

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DirectoryFinalizationLock, parseFlags, readFindingsSchema, SystemClock } from "@deep-spec/kernel-adapter";
import { ArtifactPath } from "@deep-spec/kernel-domain";
import {
  FormalModelRepositoryImplementation,
  QuintClientImplementation,
  VERIFICATION_LOCK_BASENAME,
  VerificationDirectoryRepositoryImplementation,
} from "@deep-spec/requirements-adapter";
import { FormalModelIdentifier } from "@deep-spec/requirements-domain";
import { VerifyRequirementsQuintUseCase } from "@deep-spec/requirements-usecase";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
const VERIFY_DIRNAME = "deep-spec-verify";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), VERIFY_DIRNAME));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-verify-quint: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== FORMAL_MODEL_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  // 契約2 のスキーマは合成ルートが一度だけ読む。読めなければ「読めなかった」
  // 変種として値に載せ、以後の適合判定はこの 1 つの値からだけ導く。
  const findingsSchema = readFindingsSchema(
    join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"),
  );
  const useCase = new VerifyRequirementsQuintUseCase(
    new FormalModelRepositoryImplementation(),
    new VerificationDirectoryRepositoryImplementation(
      // finalization の directory lock は「実時計」と「実 PID／OS liveness
      // probe」を要る。process.* は合成ルートだけが触れてよいので、ここで
      // 組み立てて注入する（ESRCH=不在確定、EPERM=存在確定、他は不明）。
      new DirectoryFinalizationLock(
        new SystemClock(),
        {
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
        },
        VERIFICATION_LOCK_BASENAME,
      ),
    ),
    findingsSchema,
    new QuintClientImplementation({
      quintBin: process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint",
      methodOverride: process.env.AIDLC_DEEP_SPEC_QUINT_METHOD,
      apalacheDistSet: Boolean(process.env.APALACHE_DIST),
      homeDirectory: process.env.HOME ?? "",
    }),
  );
  const outcome = useCase.execute({
    modelId: FormalModelIdentifier.of(target.value),
    verifyDirectory: reportLocation.value,
  });

  switch (outcome.kind) {
    case "not-applicable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "not-applicable" })}\n`);
      process.exit(0);
      break;
    case "model-unreadable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "ir-unreadable" })}\n`);
      process.exit(0);
      break;
    case "version-mismatch":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "ir-version-mismatch" })}\n`);
      process.exit(0);
      break;
    case "machine-uncompilable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "machine-uncompilable" })}\n`);
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
        `deep-spec-verify-quint: ${outcome.error.kind === "not-found" ? outcome.error.path : `${outcome.error.path}: ${outcome.error.kind}`}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`,
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
