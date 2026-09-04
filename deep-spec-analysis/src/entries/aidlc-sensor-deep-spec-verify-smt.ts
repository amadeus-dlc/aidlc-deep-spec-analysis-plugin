// deep-spec-verify-smt sensor — SMT backend (z3, method: exhaustive).
//
// Deterministically compiles the deep-spec IR (contract 1) to SMT-LIB in
// TypeScript, executes z3 (z3-solver WASM) and writes normalized findings
// (contract 2) to <dirname(output)>/deep-spec-verify/smt.json.
//
// Checks (natures: invariant / event / numeric):
//   (a) conflict          — jointly unsatisfiable obligations, attributed to
//                           FR ids via unsat cores (global + antecedent
//                           vacuity + same-trigger contradictory effects);
//   (b) completeness-gap  — an input state no rule of a trigger covers;
//   (c) scenario check    — accept/reject examples verified by witness.
//
// 合成ルート（配線のみ）：ユースケースが Repository / Client を保持し、
// execute が成果物パス（識別）から形式モデルを解決して検証〜永続化〜
// クロスチェック再計算までを起動する。env（タイムアウト・ランタイム上書き）
// と自パス・スキーマパスはここで解決して注入する。
// --smt-child は z3 実行の子プロセス分岐（プロトコル凍結——design の refinement
// この子を spawn する）。ソルバ欠如は unavailable 文書へ降格して exit 127。

import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DirectoryFinalizationLock, SystemClock, parseFlags, readContractSchema } from "@deep-spec/kernel-adapter";
import { ArtifactPath, FindingsSchema } from "@deep-spec/kernel-domain";
import { FormalModelId } from "@deep-spec/requirements-domain";
import { VerifyRequirementsSmtUseCase } from "@deep-spec/requirements-usecase";
import {
  FormalModelRepositoryImpl,
  VERIFICATION_LOCK_BASENAME,
  VerificationDirectoryRepositoryImpl,
  Z3SolverClientImpl,
  solveSmtChild,
} from "@deep-spec/requirements-adapter";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
const VERIFY_DIRNAME = "deep-spec-verify";

function parentMain(): void {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join(dirname(flags.outputPath), VERIFY_DIRNAME));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write("deep-spec-verify-smt: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== FORMAL_MODEL_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const selfPath = fileURLToPath(import.meta.url);
  // 契約2 のスキーマは合成ルートが一度だけ読む。読めなければ「読めなかった」
  // 変種として値に載せ、以後の適合判定はこの 1 つの値からだけ導く。
  const findingsSchemaFile = readContractSchema(join(dirname(selfPath), "data", "deep-spec-findings-schema.json"));
  const findingsSchema = findingsSchemaFile.ok
    ? FindingsSchema.of(findingsSchemaFile.value)
    : FindingsSchema.unreadable(findingsSchemaFile.error.cause);
  const useCase = new VerifyRequirementsSmtUseCase(
    new FormalModelRepositoryImpl(),
    new VerificationDirectoryRepositoryImpl(
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
      }, VERIFICATION_LOCK_BASENAME),
    ),
    findingsSchema,
    new Z3SolverClientImpl({
      selfPath,
      perQueryTimeoutMs: Number(process.env.AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS) || 2000,
      runtimeOverride: process.env.AIDLC_DEEP_SPEC_SMT_RUNTIME,
      workingDirectory: process.cwd(),
    }),
  );
  const outcome = useCase.execute({
    modelId: FormalModelId.of(target.value),
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
    case "solver-unavailable":
      // 127 = tool-unavailable to the dispatcher; the findings file already
      // records the degradation for the stage.
      process.exit(127);
      break;
    case "acquisition-failed":
    case "save-failed":
      process.stderr.write(`deep-spec-verify-smt: ${outcome.error.kind === "not-found" ? outcome.error.path : `${outcome.error.path}: ${outcome.error.kind}`}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}\n`);
      process.exit(1);
      break;
    case "verified":
      process.stdout.write(
        `${JSON.stringify({ pass: outcome.pass, findings_count: outcome.findingsCount, skipped_count: outcome.skippedCount, method: "exhaustive" })}\n`,
      );
      process.exit(0);
      break;
  }
}

if (process.argv.includes("--smt-child")) {
  // 親は stdout の最終行を JSON として解析する。パイプ書込の完了前に exit
  // すると出力が切れて unavailable 扱いになり得るため、flush 後に終了する。
  process.stdout.write(await solveSmtChild(), () => process.exit(0));
} else {
  parentMain();
}
