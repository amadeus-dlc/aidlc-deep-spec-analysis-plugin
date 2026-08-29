// DesignReport の実 Gateway 実装。保存先／読出元は集約識別子（directory +
// backend）から導出する。契約適合（conformedOf）は serializer の知識で実装し、
// save は常に conformed な姿を書く。findAllByDirectory はクロスチェックの
// 凍結取得規則：cross-check.json を除く *.json をファイル名順で読み、読めない
// ファイルは黙って除く。

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { Json } from "../../kernel/adapter/index.ts";
import { readContractSchema } from "../../kernel/adapter/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { DesignReport, DesignReportId } from "../domain/index.ts";
import type { DesignReportRepository } from "../usecase/index.ts";
import {
  conformDesignReport,
  parseSiblingDesignReportDocument,
  renderDesignReportBytes,
} from "./design-report-serializer.ts";

export class DesignReportRepositoryImpl implements DesignReportRepository {
  readonly #findingsSchemaPath: string;

  constructor(findingsSchemaPath: string) {
    this.#findingsSchemaPath = findingsSchemaPath;
  }

  findById(aggregateId: DesignReportId): Result<DesignReport, RepositoryError> {
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
    const report = parseSiblingDesignReportDocument(aggregateId.directory(), aggregateId.fileName(), raw);
    if (report === null) {
      return err({ kind: "corrupt", path, cause: "document is not a JSON object" });
    }
    return ok(report);
  }

  findAllByDirectory(directory: string): Result<readonly DesignReport[], RepositoryError> {
    let entries: string[];
    try {
      entries = readdirSync(directory)
        .filter((f) => f.endsWith(".json") && f !== "cross-check.json")
        .sort();
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: directory, cause: e instanceof Error ? e.message : String(e) });
    }
    const reports: DesignReport[] = [];
    for (const file of entries) {
      try {
        const raw = JSON.parse(readFileSync(join(directory, file), "utf-8")) as Json;
        const report = parseSiblingDesignReportDocument(directory, file, raw);
        if (report !== null) reports.push(report);
      } catch {
        // 読めない兄弟文書は黙って除く——その状態は自分の書き手が報告する。
      }
    }
    return ok(reports);
  }

  conformedOf(report: DesignReport): DesignReport {
    return conformDesignReport(report, readContractSchema(this.#findingsSchemaPath));
  }

  save(report: DesignReport): Result<void, RepositoryError> {
    const conformed = this.conformedOf(report);
    const path = join(conformed.id().directory(), conformed.id().fileName());
    try {
      mkdirSync(conformed.id().directory(), { recursive: true });
      writeFileSync(path, renderDesignReportBytes(conformed), "utf-8");
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
