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

import type { Result } from "../../kernel/domain/index.ts";
import { ok } from "../../kernel/domain/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import {
  SUPPORTED_IR_MAJOR,
  VerificationReport,
  VerificationReportId,
  type RequirementsModel,
  crossCheckReport,
  interpretSmtVerdicts,
  irUnreadableReport,
  solverUnavailableReport,
  versionMismatchReport,
} from "../domain/index.ts";
import type { FormalModelRepository } from "./formal-model-repository.ts";
import type { VerificationReportRepository } from "./verification-report-repository.ts";
import type { VerifySmtOutcome } from "./verify-smt-outcome.ts";
import type { Z3SolverClient } from "./z3-solver-client.ts";

const BACKEND = "smt";
const CROSS_CHECK_BACKEND = "cross-check";

export interface VerifyRequirementsSmtInput {
  readonly modelPath: string;
  readonly verifyDirectory: string;
}

export class VerifyRequirementsSmtUseCase {
  readonly #formalModels: FormalModelRepository;
  readonly #reports: VerificationReportRepository;
  readonly #solver: Z3SolverClient;

  constructor(formalModels: FormalModelRepository, reports: VerificationReportRepository, solver: Z3SolverClient) {
    this.#formalModels = formalModels;
    this.#reports = reports;
    this.#solver = solver;
  }

  execute(input: VerifyRequirementsSmtInput): VerifySmtOutcome {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModels.findByPath(input.modelPath);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(irUnreadableReport(id, acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const { model, irHash } = acquired.value;

    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#persist(versionMismatchReport(id, model, irHash));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "version-mismatch" };
    }

    const run = this.#solver.check(model);
    if (run.result.kind === "unavailable") {
      const saved = this.#persist(solverUnavailableReport(id, model, irHash, run.facts.skipped, run.result.reason));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "solver-unavailable" };
    }

    const interpreted = interpretSmtVerdicts(model, run.facts, run.result.verdicts);
    const conformed = this.#reports.conformedOf(
      VerificationReport.compose({
        id,
        irVersion: model.irVersion(),
        irHash,
        method: "exhaustive",
        findings: interpreted.findings,
        skipped: interpreted.skipped,
      }),
    );
    const saved = this.#reports.save(conformed);
    if (!saved.ok) return { kind: "save-failed", error: saved.error };
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
    return this.#reports.save(this.#reports.conformedOf(report));
  }

  // 自文書を書いた後に、同一ディレクトリの全バックエンド文書からクロス
  // チェックを再計算する（最後の書き手が勝ち、全書き手が同一バイトへ収束）。
  #recomputeCrossCheck(model: RequirementsModel, irHash: string, directory: string): Result<void, RepositoryError> {
    const siblings = this.#reports.findAllByDirectory(directory);
    // 旧挙動: ディレクトリが読めないときは黙って諦める（自文書は書けている）。
    if (!siblings.ok) return ok(undefined);
    return this.#persist(crossCheckReport(VerificationReportId.of(directory, CROSS_CHECK_BACKEND), model, irHash, siblings.value));
  }
}
