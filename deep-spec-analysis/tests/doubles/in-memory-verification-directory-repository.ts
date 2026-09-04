// VerificationDirectoryRepository の InMemory ダブル（production グレード：
// ポート契約に完全準拠）。ポートの語彙は findByDirectory / store の 2 つだけ
// で、適合（conformedTo）もクロスチェックの導出も集約の振る舞いなので、この
// ダブルは「集約を丸ごと入れて丸ごと出す」だけを担う。
//
// findByDirectory は実装と同じ凍結取得規則（cross-check 除外・ファイル名順）を
// キー空間上で再現し、store は集約の候補とクロスチェックを公開する——導けな
// かったクロスチェックは実装（stale へ退避して再公開しない）と同じく消える。
//
// 末尾の 2 つはテスト専用の読み取り面であってポートの一部ではない：書かれた
// 個々の文書を検査するために、ダブルのキー空間をそのまま覗く。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import {
  VerificationDirectory,
  type VerificationReport,
  type VerificationReportId,
  VerificationReports,
} from "@deep-spec/requirements-domain";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { VerificationDirectoryRepository } from "@deep-spec/requirements-usecase";

const CROSS_CHECK_FILENAME = "cross-check.json";

export class InMemoryVerificationDirectoryRepository implements VerificationDirectoryRepository {
  readonly #store = new Map<string, VerificationReport>();

  #keyOf(id: VerificationReportId): string {
    return `${id.directory().asString()}/${id.fileName()}`;
  }

  findByDirectory(directory: ArtifactPath): Result<VerificationDirectory, RepositoryError> {
    const prefix = `${directory.asString()}/`;
    const siblings = [...this.#store.entries()]
      .filter(([key]) => key.startsWith(prefix) && key !== `${prefix}${CROSS_CHECK_FILENAME}`)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, report]) => report);
    const crossCheck = this.#store.get(`${prefix}${CROSS_CHECK_FILENAME}`) ?? null;
    return ok(VerificationDirectory.of(directory, VerificationReports.of(siblings), crossCheck));
  }

  store(aggregate: VerificationDirectory): Result<void, RepositoryError> {
    const candidate = aggregate.candidate();
    if (candidate === null) {
      return err({ kind: "io-failed", operation: "write", path: aggregate.directory().asString(), cause: "no finalization candidate" });
    }
    this.#store.set(this.#keyOf(candidate.id()), candidate);
    const crossCheck = aggregate.crossCheck();
    const crossKey = `${aggregate.directory().asString()}/${CROSS_CHECK_FILENAME}`;
    // 導けなかったクロスチェックは古いまま残さない（実装は stale へ退避する）。
    if (crossCheck === null) this.#store.delete(crossKey);
    else this.#store.set(crossKey, crossCheck);
    return ok(undefined);
  }

  // --- テスト専用の読み取り面（ポートではない）-------------------------------

  findById(aggregateId: VerificationReportId): Result<VerificationReport, RepositoryError> {
    const found = this.#store.get(this.#keyOf(aggregateId));
    if (found === undefined) {
      return err({ kind: "not-found", path: this.#keyOf(aggregateId) });
    }
    return ok(found);
  }

  findAllByDirectory(directory: ArtifactPath): Result<VerificationReports, RepositoryError> {
    const loaded = this.findByDirectory(directory);
    return loaded.ok ? ok(loaded.value.reports()) : err(loaded.error);
  }
}
