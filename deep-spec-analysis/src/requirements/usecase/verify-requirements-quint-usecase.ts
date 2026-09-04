// deep-spec-verify-quint の interactor。Repository / Client を保持し、execute は
// 成果物パス（識別）を受けて内部で形式モデルを解決し、Quint 検証 → 解釈 →
// レポート組成 → finalization（適合・クロスチェック・一塊の公開）までを起動する。
//
// 経路の凍結挙動（旧 main と同値）:
//   - モデル不在 → not-applicable（文書を書かない）
//   - IR 不成立 → ir-unreadable 降格文書（method "simulation"、クロスチェック
//     は導けない）
//   - major 不一致 → 全対象 skip の文書（method "simulation"）＋クロスチェック
//   - quint CLI 不在 → unavailable 文書＋クロスチェック（entry が 127）
//   - 機械コンパイル不能 → 全対象 compile-error の文書＋クロスチェック
//     （entry は note つき exit 0）
//   - 検証成立 → findings 文書＋クロスチェック。verdict は保存した集約の候補
//     （＝書かれた姿）から導出する。
// 適合と両文書の公開は VerificationReportFinalizer が一か所で持つ——ここに残る
// のは Quint 固有の method 検出とコンパイル判断だけ。

import { VerificationReport, VerificationReportId } from "@deep-spec/requirements-domain";
import { SUPPORTED_IR_MAJOR } from "@deep-spec/requirements-domain";
import type { FindingsSchema } from "@deep-spec/kernel-domain";
import type { FormalModelRepository } from "./port/formal-model-repository.ts";
import type { QuintClient } from "./port/quint-client.ts";
import type { VerificationDirectoryRepository } from "./port/verification-directory-repository.ts";
import type { VerifyQuintOutcome } from "./verify-quint-outcome.ts";
import type { VerifyRequirementsQuintInput } from "./verify-requirements-quint-input.ts";
import { VerificationReportFinalizer } from "./verification-report-finalizer.ts";

const BACKEND = "quint";

export class VerifyRequirementsQuintUseCase {
  readonly #formalModelRepository: FormalModelRepository;
  readonly #quintClient: QuintClient;
  readonly #finalizer: VerificationReportFinalizer;

  constructor(
    formalModelRepository: FormalModelRepository,
    verificationDirectoryRepository: VerificationDirectoryRepository,
    findingsSchema: FindingsSchema,
    quintClient: QuintClient,
  ) {
    this.#formalModelRepository = formalModelRepository;
    this.#quintClient = quintClient;
    this.#finalizer = new VerificationReportFinalizer(verificationDirectoryRepository, findingsSchema);
  }

  execute(input: VerifyRequirementsQuintInput): VerifyQuintOutcome {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed") return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#finalizer.finalizeIrUnreadable(VerificationReport.irUnreadable(id, "simulation", acquired.error.cause));
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();

    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#finalizer.finalize(VerificationReport.versionMismatch(id, model, irHash, "simulation"), model);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "version-mismatch" };
    }

    const checked = this.#quintClient.check(model);
    if (checked.kind === "cli-unavailable") {
      const saved = this.#finalizer.finalize(VerificationReport.quintUnavailable(id, model, irHash), model);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "backend-unavailable" };
    }
    if (checked.kind === "machine-uncompilable") {
      const uncompilable = VerificationReport.machineUncompilable(id, model, irHash, checked.method, checked.error);
      const saved = this.#finalizer.finalize(uncompilable, model);
      if (!saved.ok) return { kind: "save-failed", error: saved.error };
      return { kind: "machine-uncompilable" };
    }

    const interpreted = checked.plan.interpret(model, checked.compileSkips, checked.method, checked.runs);
    const report = VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: checked.method,
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
      method: checked.method,
    };
  }
}
