// 設計検証の共通取得境界（Workflow 5 の 1〜5）。SMT／Quint の冒頭で同形だった
// 「モデル取得 → 3 種の失敗分類 → IR version の適合判定」を一度だけ所有する
// application collaborator であって、ドメインオブジェクトではない（BR5.1）。
//
// 入力は 3 つだけ：modelId、呼出側が生成した DesignReportIdentifier、strict に生成
// 済みの初期 VerificationMethod。backend 名の文字列・mode boolean・unknown の
// payload・optional hook は受け取らない——backend 固有の判断（solver・probe・
// budget・refinement）は各 usecase に残る（BR5.2）。

import type { DesignModelIdentifier, DesignReportIdentifier } from "@deep-spec/design-domain";
import { DesignReport, SUPPORTED_DESIGN_IR_MAJOR } from "@deep-spec/design-domain";
import type { VerificationMethod } from "@deep-spec/kernel-domain";
import type { DesignAcquisitionResult } from "./design-acquisition-result.ts";
import type { DesignReportFinalizer } from "./design-report-finalizer.ts";
import type { DesignModelRepository } from "./port/design-model-repository.ts";

export class DesignVerificationAcquirer {
  readonly #designModelRepository: DesignModelRepository;
  readonly #finalizer: DesignReportFinalizer;

  constructor(designModelRepository: DesignModelRepository, finalizer: DesignReportFinalizer) {
    this.#designModelRepository = designModelRepository;
    this.#finalizer = finalizer;
  }

  acquire(
    modelId: DesignModelIdentifier,
    reportId: DesignReportIdentifier,
    method: VerificationMethod,
  ): DesignAcquisitionResult {
    // 2. 取得結果の分類は一度だけ：不在は not-applicable、I/O の失敗は
    //    acquisition-failed（どちらも文書を書かない）。
    const acquired = this.#designModelRepository.findById(modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found") return { kind: "terminal", outcome: { kind: "not-applicable" } };
      if (acquired.error.kind === "io-failed") {
        return { kind: "terminal", outcome: { kind: "acquisition-failed", error: acquired.error } };
      }
      // 3. 読めたが集約として成立しない入力は、初期 method の irUnreadable を
      //    Finalizer で保存する。保存に失敗したら verified 側へ抜けない。
      const unreadable = DesignReport.irUnreadable(reportId, method.asString(), acquired.error.cause);
      const saved = this.#finalizer.finalizeIrUnreadable(unreadable);
      if (!saved.ok) return { kind: "terminal", outcome: { kind: "save-failed", error: saved.error } };
      return { kind: "terminal", outcome: { kind: "model-unreadable" } };
    }
    const model = acquired.value;
    const irHash = model.irHash();

    // 4. 対応外の major は versionMismatch を Finalizer で保存する。
    if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
      const mismatch = DesignReport.versionMismatch(reportId, model, irHash, method.asString());
      // 旧実装は conform 前の skip 数を verdict 行に載せていた——凍結挙動。
      const skippedCount = mismatch.skippedCount();
      const saved = this.#finalizer.finalize(mismatch, model);
      if (!saved.ok) return { kind: "terminal", outcome: { kind: "save-failed", error: saved.error } };
      return { kind: "terminal", outcome: { kind: "version-mismatch", skippedCount } };
    }

    // 5. ここが共通境界の終端。以降は backend 固有の処理へ戻る。
    return { kind: "ready", model, irHash };
  }
}
