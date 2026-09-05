// Report finalization（Workflow 1 の 2〜4）を一か所で持つ application collaborator。
// SMT／Quint の両 interactor と DesignVerificationAcquirer が同じこの実装を通る
// ——「適合は一度だけ」「永続化に成功するまで verified を返さない」という共通の
// 変更理由が 2 か所へ複製されないようにするのが役目（BR1.1／BR1.2）。
// ドメインオブジェクトではない：filesystem・lock・backend 固有の solver 判断は
// どれも所有せず、それらは Repository アダプタの側にある。契約2 のスキーマは
// 合成ルートが一度だけ読んで値として注入する——ここも Repository も読まない。

import type { DesignModel, DesignReport } from "@deep-spec/design-domain";
import type { FindingsSchema } from "@deep-spec/kernel-domain";
import type { Result } from "@deep-spec/kernel-infrastructure";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { DesignVerifyDirectoryRepository } from "./port/design-verify-directory-repository.ts";
import type { VerifyDesignOutcome } from "./verify-design-outcome.ts";

// 永続化に成功したときだけ作られる verdict。公開する型を増やさないため、
// 既存の成功変種をそのまま名前で借りる（新しい結果型ではない）。
type VerifiedOutcome = Extract<VerifyDesignOutcome, { kind: "verified" }>;

export class DesignReportFinalizer {
  readonly #repository: DesignVerifyDirectoryRepository;
  readonly #findingsSchema: FindingsSchema;

  constructor(repository: DesignVerifyDirectoryRepository, findingsSchema: FindingsSchema) {
    this.#repository = repository;
    this.#findingsSchema = findingsSchema;
  }

  // Workflow 1 の 2〜4：ディレクトリ集約を取得し、候補を置き、クロスチェックを
  // 導き、契約2 へ適合させてから一塊で保存する。verdict は「保存したのと同じ
  // 集約」の候補から導く——stdout とファイルが食い違わない唯一の作り方。
  finalize(report: DesignReport, model: DesignModel): Result<VerifiedOutcome, RepositoryError> {
    return this.#finalizing(report, model);
  }

  // Workflow 5 の 3：設計 IR が読めないときは DesignModel が無く、兄弟集合から
  // クロスチェックを導けない。導けないのは cross-check だけで、直列化と
  // atomic write に model は要らない——同じ経路で自文書だけを公開する。
  finalizeIrUnreadable(report: DesignReport): Result<void, RepositoryError> {
    const finalized = this.#finalizing(report, null);
    if (!finalized.ok) return err(finalized.error);
    return ok(undefined);
  }

  #finalizing(report: DesignReport, model: DesignModel | null): Result<VerifiedOutcome, RepositoryError> {
    const loaded = this.#repository.findByDirectory(report.id().directory());
    if (!loaded.ok) return err(loaded.error);
    const aggregate = loaded.value.finalizedWith(report, model, this.#findingsSchema);
    const stored = this.#repository.store(aggregate);
    if (!stored.ok) return err(stored.error);
    const published = aggregate.candidate();
    if (published === null) {
      // finalizing が候補を置いた直後なので到達しない。黙って成功させない。
      return err({
        kind: "io-failed",
        operation: "write",
        path: report.id().fileName(),
        cause: "no finalization candidate",
      });
    }
    return ok({
      kind: "verified",
      pass: published.passes(),
      findingsCount: published.findingsCount(),
      skippedCount: published.skippedCount(),
      method: published.method(),
    });
  }
}
