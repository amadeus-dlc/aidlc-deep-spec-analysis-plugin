// Report finalization（候補の適合・クロスチェックの導出・一塊の保存）を一か所
// で持つ application collaborator。SMT／Quint の両 interactor が同じこの実装を
// 通る——「適合は一度だけ」「永続化に成功するまで verified を返さない」という
// 共通の変更理由が 2 か所へ複製されないようにするのが役目。
// ドメインオブジェクトではない：filesystem・lock・backend 固有の solver 判断は
// どれも所有せず、それらは Repository アダプタの側にある。契約2 のスキーマは
// 合成ルートが一度だけ読んで値として注入する——ここも Repository も読まない。
//
// 戻り値は「保存したのと同じ集約の候補」。SMT と Quint は verdict 行の形が
// 違う（Quint だけ method を載せる）ので、共通の verdict 型を新設せず、公開
// 済みの report をそのまま返して各 interactor が自分の outcome を組む——
// stdout とファイルが食い違わない唯一の作り方は変わらない。

import type { Result } from "@deep-spec/kernel-infrastructure";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { FindingsSchema } from "@deep-spec/kernel-domain";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { RequirementsModel, VerificationReport } from "@deep-spec/requirements-domain";
import type { VerificationDirectoryRepository } from "./port/verification-directory-repository.ts";

export class VerificationReportFinalizer {
  readonly #repository: VerificationDirectoryRepository;
  readonly #findingsSchema: FindingsSchema;

  constructor(repository: VerificationDirectoryRepository, findingsSchema: FindingsSchema) {
    this.#repository = repository;
    this.#findingsSchema = findingsSchema;
  }

  // ディレクトリ集約を取得し、候補を置き、クロスチェックを導き、契約2 へ適合
  // させてから一塊で保存する。verdict は「保存したのと同じ集約」の候補から導く。
  finalize(report: VerificationReport, model: RequirementsModel): Result<VerificationReport, RepositoryError> {
    return this.#finalizing(report, model);
  }

  // IR が読めないときは RequirementsModel が無く、兄弟集合からクロスチェックを
  // 導けない。導けないのは cross-check だけで、直列化と atomic write に model は
  // 要らない——同じ経路で自文書だけを公開する。
  finalizeIrUnreadable(report: VerificationReport): Result<void, RepositoryError> {
    const finalized = this.#finalizing(report, null);
    if (!finalized.ok) return err(finalized.error);
    return ok(undefined);
  }

  #finalizing(
    report: VerificationReport,
    model: RequirementsModel | null,
  ): Result<VerificationReport, RepositoryError> {
    const loaded = this.#repository.findByDirectory(report.id().directory());
    if (!loaded.ok) return err(loaded.error);
    const aggregate = loaded.value.finalizedWith(report, model, this.#findingsSchema);
    const stored = this.#repository.store(aggregate);
    if (!stored.ok) return err(stored.error);
    const published = aggregate.candidate();
    if (published === null) {
      // finalizing が候補を置いた直後なので到達しない。黙って成功させない。
      return err({ kind: "io-failed", operation: "write", path: report.id().fileName(), cause: "no finalization candidate" });
    }
    return ok(published);
  }
}
