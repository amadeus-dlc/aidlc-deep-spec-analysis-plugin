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

import type { ArtifactPath, ContentHash } from "../../kernel/domain/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { ok } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import {
  SUPPORTED_IR_MAJOR,
  VerificationReport,
  VerificationReportId,
  type RequirementsModel,
} from "../domain/index.ts";
import type { FormalModelRepository } from "./port/formal-model-repository.ts";
import type { QuintClient } from "./port/quint-client.ts";
import type { VerificationReportRepository } from "./port/verification-report-repository.ts";
import type { VerifyQuintOutcome } from "./verify-quint-outcome.ts";
import type { VerifyRequirementsQuintInput } from "./verify-requirements-quint-input.ts";

const BACKEND = "quint";
const CROSS_CHECK_BACKEND = "cross-check";


export class VerifyRequirementsQuintUseCase {
  readonly #formalModelRepository: FormalModelRepository;
  readonly #verificationReportRepository: VerificationReportRepository;
  readonly #quintClient: QuintClient;

  constructor(formalModelRepository: FormalModelRepository, verificationReportRepository: VerificationReportRepository, quintClient: QuintClient) {
    this.#formalModelRepository = formalModelRepository;
    this.#verificationReportRepository = verificationReportRepository;
    this.#quintClient = quintClient;
  }

  execute(input: VerifyRequirementsQuintInput): VerifyQuintOutcome {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(VerificationReport.irUnreadable(id, "simulation", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();

    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#persist(VerificationReport.versionMismatch(id, model, irHash, "simulation"));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "version-mismatch" };
    }

    const checked = this.#quintClient.check(model);
    if (checked.kind === "cli-unavailable") {
      const saved = this.#persist(VerificationReport.quintUnavailable(id, model, irHash));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "backend-unavailable" };
    }
    if (checked.kind === "machine-uncompilable") {
      const saved = this.#persist(VerificationReport.machineUncompilable(id, model, irHash, checked.method, checked.error));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross.ok) return { kind: "save-failed", error: cross.error };
      return { kind: "machine-uncompilable" };
    }

    const interpreted = checked.facts.interpret(model, checked.compileSkips, checked.method, checked.runs);
    const stored = this.#verificationReportRepository.store(
      VerificationReport.compose({
        id,
        irVersion: model.irVersion(),
        irHash,
        method: checked.method,
        findings: interpreted.findings,
        skipped: interpreted.skipped,
      }),
    );
    if (!stored.ok) return { kind: "save-failed", error: stored.error };
    const conformed = stored.value;
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

  #persist(report: VerificationReport): Result<VerificationReport, RepositoryError> {
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
