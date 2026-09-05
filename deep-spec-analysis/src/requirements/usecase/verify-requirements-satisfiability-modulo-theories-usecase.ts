// deep-spec-verify-smt の interactor。Repository / Client を保持し、execute は
// 成果物パス（識別）を受けて内部で形式モデルを解決し、SMT 検証 → 解釈 →
// レポート組成 → finalization（適合・クロスチェック・一塊の公開）までを起動する。
//
// 経路の凍結挙動（旧 parentMain と同値）:
//   - モデル不在 → not-applicable（文書を書かない）
//   - IR 不成立 → ir-unreadable 降格文書を書く（クロスチェックは導けない）
//   - major 不一致 → 全対象 skip の文書＋クロスチェック
//   - ソルバ実行不能 → unavailable 文書＋クロスチェック（entry が 127）
//   - 検証成立 → findings 文書＋クロスチェック。verdict は保存した集約の候補
//     （＝書かれた姿）から導出する。
// 適合と両文書の公開は VerificationReportFinalizer が一か所で持つ——ここに残る
// のは SMT 固有の solver 判断だけ。

import { VerificationReport, VerificationReportIdentifier } from "@deep-spec/requirements-domain";
import { SUPPORTED_IR_MAJOR } from "@deep-spec/requirements-domain";
import type { FindingsSchema } from "@deep-spec/kernel-domain";
import type { FormalModelRepository } from "./port/formal-model-repository.ts";
import type { VerificationDirectoryRepository } from "./port/verification-directory-repository.ts";
import type { VerifySatisfiabilityModuloTheoriesOutcome } from "./verify-satisfiability-modulo-theories-outcome.ts";
import type { Z3SolverClient } from "./port/z3-solver-client.ts";
import type { VerifyRequirementsSatisfiabilityModuloTheoriesInput } from "./verify-requirements-satisfiability-modulo-theories-input.ts";
import { VerificationReportFinalizer } from "./verification-report-finalizer.ts";

const BACKEND = "smt";

export class VerifyRequirementsSatisfiabilityModuloTheoriesUseCase {
  readonly #formalModelRepository: FormalModelRepository;
  readonly #z3SolverClient: Z3SolverClient;
  readonly #finalizer: VerificationReportFinalizer;

  constructor(
    formalModelRepository: FormalModelRepository,
    verificationDirectoryRepository: VerificationDirectoryRepository,
    findingsSchema: FindingsSchema,
    z3SolverClient: Z3SolverClient,
  ) {
    this.#formalModelRepository = formalModelRepository;
    this.#z3SolverClient = z3SolverClient;
    this.#finalizer = new VerificationReportFinalizer(verificationDirectoryRepository, findingsSchema);
  }

  execute(input: VerifyRequirementsSatisfiabilityModuloTheoriesInput): VerifySatisfiabilityModuloTheoriesOutcome {
    const id = VerificationReportIdentifier.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#finalizer.finalizeIrUnreadable(VerificationReport.irUnreadable(id, "exhaustive", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();

    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#finalizer.finalize(VerificationReport.versionMismatch(id, model, irHash, "exhaustive"), model);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "version-mismatch" };
    }

    const run = this.#z3SolverClient.check(model);
    if (run.result.kind === "unavailable") {
      const unavailable = VerificationReport.solverUnavailable(id, model, irHash, run.plan.planSkipped(), run.result.reason);
      const saved = this.#finalizer.finalize(unavailable, model);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
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
    // 適合・両文書の公開・cleanup は Finalizer が一か所で持つ。兄弟が読めない・
    // クロスチェックが書けないときは verified を返さず失敗を運ぶ。
    const finalized = this.#finalizer.finalize(report, model);
    if (!finalized.ok) return { kind: "save-failed", error: finalized.error };
    const published = finalized.value;
    return {
      kind: "verified",
      pass: published.passes(),
      findingsCount: published.findingsCount(),
      skippedCount: published.skippedCount(),
    };
  }
}
