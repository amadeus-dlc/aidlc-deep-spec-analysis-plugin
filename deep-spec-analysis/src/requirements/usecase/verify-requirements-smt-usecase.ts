// deep-spec-verify-smt の interactor。Repository / Client を保持し、execute は
// 成果物パス（識別）を受けて内部で形式モデルを解決し、SMT 検証 → 解釈 →
// レポート組成 → 契約適合 → 永続化 → クロスチェック再計算までを起動する。
//
// 経路の凍結挙動（旧 parentMain と同値）:
//   - モデル不在 → not-applicable（文書を書かない）
//   - IR 不成立 → ir-unreadable 降格文書を書く（クロスチェックは再計算しない）
//   - major 不一致 → 全対象 skip の文書＋クロスチェック再計算
//   - ソルバ実行不能 → unavailable 文書＋クロスチェック再計算（entry が 127）
//   - 検証成立 → findings 文書＋クロスチェック再計算。verdict は conformed
//     （＝書かれた姿）から導出する。

import type { ArtifactPath, ContentHash } from "@deep-spec/kernel-domain";
import type { Result } from "@deep-spec/kernel-infrastructure";
import { ok } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import {
  SUPPORTED_IR_MAJOR,
  VerificationReport,
  VerificationReportId,
  type RequirementsModel,
} from "@deep-spec/requirements-domain";
import type { FormalModelRepository } from "./port/formal-model-repository.ts";
import type { VerificationReportRepository } from "./port/verification-report-repository.ts";
import type { VerifySmtOutcome } from "./verify-smt-outcome.ts";
import type { Z3SolverClient } from "./port/z3-solver-client.ts";
import type { VerifyRequirementsSmtInput } from "./verify-requirements-smt-input.ts";

const BACKEND = "smt";
const CROSS_CHECK_BACKEND = "cross-check";


export class VerifyRequirementsSmtUseCase {
  readonly #formalModelRepository: FormalModelRepository;
  readonly #verificationReportRepository: VerificationReportRepository;
  readonly #z3SolverClient: Z3SolverClient;

  constructor(formalModelRepository: FormalModelRepository, verificationReportRepository: VerificationReportRepository, z3SolverClient: Z3SolverClient) {
    this.#formalModelRepository = formalModelRepository;
    this.#verificationReportRepository = verificationReportRepository;
    this.#z3SolverClient = z3SolverClient;
  }

  execute(input: VerifyRequirementsSmtInput): VerifySmtOutcome {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(VerificationReport.irUnreadable(id, "exhaustive", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();

    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#persist(VerificationReport.versionMismatch(id, model, irHash, "exhaustive"));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "version-mismatch" };
    }

    const run = this.#z3SolverClient.check(model);
    if (run.result.kind === "unavailable") {
      const saved = this.#persist(VerificationReport.solverUnavailable(id, model, irHash, run.plan.planSkipped(), run.result.reason));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "solver-unavailable" };
    }

    const interpreted = run.plan.interpret(model, run.result.verdicts);
    const report = VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: interpreted.findings,
      skipped: interpreted.skipped,
    });
    // CQS: verdict は conformedOf（照会）から導き、store は書くだけ（void）。
    const conformed = this.#verificationReportRepository.conformedOf(report);
    const stored = this.#verificationReportRepository.store(report);
    if (!stored.ok) return { kind: "save-failed", error: stored.error };
    const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
    if (!cross.ok) return { kind: "save-failed", error: cross.error };
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
    };
  }

  #persist(report: VerificationReport): Result<void, RepositoryError> {
    return this.#verificationReportRepository.store(report);
  }

  // 自文書を書いた後に、同一ディレクトリの全バックエンド文書からクロス
  // チェックを再計算する（最後の書き手が勝ち、全書き手が同一バイトへ収束）。
  #recomputeCrossCheck(model: RequirementsModel, irHash: ContentHash, directory: ArtifactPath): Result<void, RepositoryError> {
    const siblings = this.#verificationReportRepository.findAllByDirectory(directory);
    // 旧挙動: ディレクトリが読めないときは黙って諦める（自文書は書けている）。
    if (!siblings.ok) return ok(undefined);
    const stored = this.#persist(siblings.value.crossChecked(VerificationReportId.of(directory, CROSS_CHECK_BACKEND), model, irHash));
    return stored.ok ? ok(undefined) : stored;

  }
}
