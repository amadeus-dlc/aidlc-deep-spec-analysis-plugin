// ReferenceCheckReportRepository の実 Gateway 実装。
// 保存先／読出元は集約識別子（directory + fileName）から導出する。
// 直列化・解体は serializer の責務、ここは I/O と RepositoryError への写像。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "../../kernel/domain/index.ts";
import type { Json } from "../../kernel/adapter/json-value.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "../domain/index.ts";
import type { ReferenceCheckReportRepository } from "../usecase/index.ts";
import { parseReportDocument, renderReportBytes } from "./reference-check-report-serializer.ts";

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
    const report = parseReportDocument(aggregateId, raw);
    if (!report.ok) {
      return err({ kind: "corrupt", path, cause: report.error.cause });
    }
    return report;
  }

  save(report: ReferenceCheckReport): Result<void, RepositoryError> {
    const path = join(report.id().directory(), report.id().fileName());
    try {
      mkdirSync(report.id().directory(), { recursive: true });
      writeFileSync(path, renderReportBytes(report), "utf-8");
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
