// ReferenceCheckReportRepository の実 Gateway 実装。
// 保存先／読出元は集約識別子（directory + fileName）から導出する。
// 契約適合（conformedOf）は serializer の知識で実装し、save は常に
// conformed な姿を書く——「不適合ファイルを決して出さない」の実装点。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { Json } from "../../kernel/adapter/json-value.ts";
import { readContractSchema } from "../../kernel/adapter/contract-schema.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { ReferenceCheckReport, ReferenceCheckReportId } from "../domain/index.ts";
import type { ReferenceCheckReportRepository } from "../usecase/index.ts";
import { conformToContract, parseReportDocument, renderReportBytes } from "./reference-check-report-serializer.ts";

export class ReferenceCheckReportRepositoryImpl implements ReferenceCheckReportRepository {
  readonly #findingsSchemaPath: string;

  constructor(findingsSchemaPath: string) {
    this.#findingsSchemaPath = findingsSchemaPath;
  }

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

  conformedOf(report: ReferenceCheckReport): ReferenceCheckReport {
    return conformToContract(report, readContractSchema(this.#findingsSchemaPath));
  }

  save(report: ReferenceCheckReport): Result<void, RepositoryError> {
    const conformed = this.conformedOf(report);
    const path = join(conformed.id().directory(), conformed.id().fileName());
    try {
      mkdirSync(conformed.id().directory(), { recursive: true });
      writeFileSync(path, renderReportBytes(conformed), "utf-8");
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
