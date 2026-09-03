// VerificationReportRepository の InMemory ダブル（production グレード：
// ポート契約に完全準拠）。契約適合は実 serializer を使う——「不適合を書かない」
// という Repository の不変条件はダブルでも本物でなければならない。
// findAllByDirectory は実装と同じ凍結取得規則（cross-check 除外・ファイル名順）
// をキー空間上で再現する。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { Schema, SchemaUnreadable } from "@deep-spec/kernel-adapter";
import { conformToFindingsContract } from "@deep-spec/requirements-adapter";
import { type VerificationReport, type VerificationReportId, VerificationReports } from "@deep-spec/requirements-domain";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { VerificationReportRepository } from "@deep-spec/requirements-usecase";

export class InMemoryVerificationReportRepository implements VerificationReportRepository {
  readonly #findingsSchema: Result<Schema, SchemaUnreadable>;
  readonly #store = new Map<string, VerificationReport>();

  constructor(findingsSchema: Result<Schema, SchemaUnreadable>) {
    this.#findingsSchema = findingsSchema;
  }

  #keyOf(id: VerificationReportId): string {
    return `${id.directory().asString()}/${id.fileName()}`;
  }

  findById(aggregateId: VerificationReportId): Result<VerificationReport, RepositoryError> {
    const found = this.#store.get(this.#keyOf(aggregateId));
    if (found === undefined) {
      return err({ kind: "not-found", path: this.#keyOf(aggregateId) });
    }
    return ok(found);
  }

  findAllByDirectory(directory: ArtifactPath): Result<VerificationReports, RepositoryError> {
    const prefix = `${directory.asString()}/`;
    const hits = [...this.#store.entries()]
      .filter(([key]) => key.startsWith(prefix) && key !== `${prefix}cross-check.json`)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, report]) => report);
    return ok(VerificationReports.of(hits));
  }

  conformedOf(report: VerificationReport): VerificationReport {
    return conformToFindingsContract(report, this.#findingsSchema);
  }

  store(report: VerificationReport): Result<void, RepositoryError> {
    this.#store.set(this.#keyOf(report.id()), this.conformedOf(report));
    return ok(undefined);
  }
}
