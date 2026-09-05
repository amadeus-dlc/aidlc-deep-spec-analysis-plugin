// ReferenceCheckReportRepository の InMemory ダブル（production グレード：
// ポート契約に完全準拠し、契約テストで実 Impl と同一の約束を検証される）。
// 責務は集約の I/O だけ（オーナー裁定 2026-09-04）——渡された集約をそのまま
// 持つ。契約適合は usecase が保存前に一度だけ済ませるので、ダブルは schema を
// 持たない。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { ReferenceCheckReport, ReferenceCheckReportIdentifier } from "@deep-spec/refcheck-domain";
import type { ReferenceCheckReportRepository } from "@deep-spec/refcheck-usecase";

export class InMemoryReferenceCheckReportRepository implements ReferenceCheckReportRepository {
  readonly #store = new Map<string, ReferenceCheckReport>();

  #keyOf(id: ReferenceCheckReportIdentifier): string {
    return `${id.directory().asString()}/${id.fileName()}`;
  }

  findById(aggregateId: ReferenceCheckReportIdentifier): Result<ReferenceCheckReport, RepositoryError> {
    const found = this.#store.get(this.#keyOf(aggregateId));
    if (found === undefined) {
      return err({ kind: "not-found", path: this.#keyOf(aggregateId) });
    }
    return ok(found);
  }

  store(report: ReferenceCheckReport): Result<void, RepositoryError> {
    this.#store.set(this.#keyOf(report.id()), report);
    return ok(undefined);
  }
}
