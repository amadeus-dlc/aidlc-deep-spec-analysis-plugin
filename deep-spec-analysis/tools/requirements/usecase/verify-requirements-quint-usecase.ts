// deep-spec-verify-quint の interactor。Repository / Client を保持し、execute は
// 成果物パス（識別）を受けて内部で形式モデルを解決し、Quint 検証 → 解釈 →
// レポート組成 → 契約適合 → 永続化 → クロスチェック再計算までを起動する。
//
// 経路の凍結挙動（旧 main と同値）:
//   - モデル不在 → not-applicable（文書を書かない）
//   - IR 不成立 → ir-unreadable 降格文書（method "simulation"、クロスチェック
//     は再計算しない）
//   - major 不一致 → 全対象 skip の文書（method "simulation"）＋クロスチェック
//   - quint CLI 不在 → unavailable 文書＋クロスチェック（entry が 127）
//   - 機械コンパイル不能 → 全対象 compile-error の文書＋クロスチェック
//     （entry は note つき exit 0）
//   - 検証成立 → findings 文書＋クロスチェック。verdict は conformed
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
  interpretQuintVerdicts,
  irUnreadableReport,
  machineUncompilableReport,
  quintUnavailableReport,
  versionMismatchReport,
} from "../domain/index.ts";
import type { FormalModelRepository } from "./formal-model-repository.ts";
import type { QuintClient } from "./quint-client.ts";
import type { VerificationReportRepository } from "./verification-report-repository.ts";
import type { VerifyQuintOutcome } from "./verify-quint-outcome.ts";

const BACKEND = "quint";
const CROSS_CHECK_BACKEND = "cross-check";

export interface VerifyRequirementsQuintInput {
  readonly modelPath: string;
  readonly verifyDirectory: string;
}

export class VerifyRequirementsQuintUseCase {
  readonly #formalModels: FormalModelRepository;
  readonly #reports: VerificationReportRepository;
  readonly #quint: QuintClient;

  constructor(formalModels: FormalModelRepository, reports: VerificationReportRepository, quint: QuintClient) {
    this.#formalModels = formalModels;
    this.#reports = reports;
    this.#quint = quint;
  }

  execute(input: VerifyRequirementsQuintInput): VerifyQuintOutcome {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModels.findByPath(input.modelPath);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(irUnreadableReport(id, "simulation", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const { model, irHash } = acquired.value;

    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#persist(versionMismatchReport(id, model, irHash, "simulation"));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "version-mismatch" };
    }

    const checked = this.#quint.check(model);
    if (checked.kind === "cli-unavailable") {
      const saved = this.#persist(quintUnavailableReport(id, model, irHash));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "backend-unavailable" };
    }
    if (checked.kind === "machine-uncompilable") {
      const saved = this.#persist(machineUncompilableReport(id, model, irHash, checked.method, checked.error));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "machine-uncompilable" };
    }

    const interpreted = interpretQuintVerdicts(model, checked.facts, checked.compileSkips, checked.method, checked.runs);
    const conformed = this.#reports.conformedOf(
      VerificationReport.compose({
        id,
        irVersion: model.irVersion(),
        irHash,
        method: checked.method,
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
      method: checked.method,
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
