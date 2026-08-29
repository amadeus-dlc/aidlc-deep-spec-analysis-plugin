// ReferenceCheckReportRepository の実 Gateway 実装。
// 保存先／読出元は集約識別子（directory + fileName）から導出する。
// プラットフォーム API の throw はここで捕捉し、kernel 共有の
// RepositoryError（材料のみ）へ変換する（層越えの throw を作らない）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Json, type RepositoryError, type Result, err, ok } from "../../kernel/domain/index.ts";
import { ReferenceCheckReport, type ReferenceCheckReportId } from "../domain/index.ts";
import type { ReferenceCheckReportRepository } from "../usecase/index.ts";

export class ReferenceCheckReportRepositoryImpl implements ReferenceCheckReportRepository {
  findById(aggregateId: ReferenceCheckReportId): Result<ReferenceCheckReport, RepositoryError> {
    const path = join(aggregateId.directory(), aggregateId.fileName());
    if (!existsSync(path)) {
      return err({ kind: "not-found", path });
    }
    let raw: Json;
    try {
      raw = JSON.parse(readFileSync(path, "utf-8")) as Json;
    } catch (e) {
      return err({ kind: "corrupt", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const report = ReferenceCheckReport.reconstitute(aggregateId, raw);
    if (!report.ok) {
      return err({ kind: "corrupt", path, cause: report.error.cause });
    }
    return report;
  }

  save(report: ReferenceCheckReport): Result<void, RepositoryError> {
    const path = join(report.id().directory(), report.id().fileName());
    try {
      mkdirSync(report.id().directory(), { recursive: true });
      writeFileSync(path, report.renderBytes(), "utf-8");
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
