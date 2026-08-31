// ReferenceCheckReportRepository の InMemory ダブル（production グレード：
// ポート契約に完全準拠し、契約テストで実 Impl と同一の約束を検証される）。
// 契約適合は実 serializer を使う——「不適合を書かない」という Repository の
// 不変条件はダブルでも本物でなければならない。

import { type Result, err, ok } from "../../tools/kernel/infrastructure/index.ts";
import type { Schema } from "../../tools/kernel/adapter/index.ts";
import type { SchemaUnreadable } from "../../tools/kernel/adapter/index.ts";
import type { RepositoryError } from "../../tools/kernel/usecase/index.ts";
import { conformToContract } from "../../tools/refcheck/adapter/index.ts";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "../../tools/refcheck/domain/index.ts";
import type { ReferenceCheckReportConformance, ReferenceCheckReportRepository } from "../../tools/refcheck/usecase/index.ts";

export class InMemoryReferenceCheckReportRepository implements ReferenceCheckReportRepository, ReferenceCheckReportConformance {
  readonly #findingsSchema: Result<Schema, SchemaUnreadable>;
  readonly #store = new Map<string, ReferenceCheckReport>();

  constructor(findingsSchema: Result<Schema, SchemaUnreadable>) {
    this.#findingsSchema = findingsSchema;
  }

  #keyOf(id: ReferenceCheckReportId): string {
    return `${id.directory().asString()}/${id.fileName()}`;
  }

  findById(aggregateId: ReferenceCheckReportId): Result<ReferenceCheckReport, RepositoryError> {
    const found = this.#store.get(this.#keyOf(aggregateId));
    if (found === undefined) {
      return err({ kind: "not-found", path: this.#keyOf(aggregateId) });
    }
    return ok(found);
  }

  conformedOf(report: ReferenceCheckReport): ReferenceCheckReport {
    return conformToContract(report, this.#findingsSchema);
  }

  store(report: ReferenceCheckReport): Result<ReferenceCheckReport, RepositoryError> {
    const conformed = this.conformedOf(report);
    this.#store.set(this.#keyOf(report.id()), conformed);
    return ok(conformed);
  }
}
