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
import { parseFlags } from "./kernel/adapter/index.ts";
import { VerifyRequirementsQuintUseCase } from "./requirements/usecase/index.ts";
import {
  FormalModelRepositoryImpl,
  QuintClientImpl,
  VerificationReportRepositoryImpl,
} from "./requirements/adapter/index.ts";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
const VERIFY_DIRNAME = "deep-spec-verify";

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-verify-quint: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== FORMAL_MODEL_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const useCase = new VerifyRequirementsQuintUseCase(
    new FormalModelRepositoryImpl(),
    new VerificationReportRepositoryImpl(
      join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"),
    ),
    new QuintClientImpl({
      quintBin: process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint",
      methodOverride: process.env.AIDLC_DEEP_SPEC_QUINT_METHOD,
      apalacheDistSet: Boolean(process.env.APALACHE_DIST),
      homeDirectory: process.env.HOME ?? "",
    }),
  );
  const outcome = useCase.execute({
    modelPath: flags.outputPath,
    verifyDirectory: join(dirname(flags.outputPath), VERIFY_DIRNAME),
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
      process.stderr.write(`deep-spec-verify-quint: ${outcome.error.kind === "not-found" ? outcome.error.path : `${outcome.error.path}: ${outcome.error.kind}`}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`);
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
