// VerificationReportRepository の実 Gateway 実装。
// 保存先／読出元は集約識別子（directory + backend）から導出する。
// 契約適合は serializer の知識で実装し、store は常に conformed
// な姿を書く。findAllByDirectory は凍結取得規則そのもの：cross-check.json を
// 除く *.json をファイル名順で読み、読めないファイルは黙って除く（その状態は
// 各書き手が自分の文書で報告する——旧 recomputeCrossCheck の読込と同値）。

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { Json } from "../../kernel/adapter/index.ts";
import { readContractSchema } from "../../kernel/adapter/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import type { VerificationReport, VerificationReportId } from "../domain/index.ts";
import { VerificationReports } from "../domain/index.ts";
import type { VerificationReportRepository } from "../usecase/index.ts";
import {
  conformToFindingsContract,
  parseSiblingReportDocument,
  parseVerificationReportDocument,
  renderVerificationReportBytes,
} from "./verification-report-serializer.ts";

export class VerificationReportRepositoryImpl implements VerificationReportRepository {
  readonly #findingsSchemaPath: string;

  constructor(findingsSchemaPath: string) {
    this.#findingsSchemaPath = findingsSchemaPath;
  }

  findById(aggregateId: VerificationReportId): Result<VerificationReport, RepositoryError> {
    const path = join(aggregateId.directory().asString(), aggregateId.fileName());
    if (!existsSync(path)) {
      return err({ kind: "not-found", path });
    }
    let raw: Json;
    try {
      raw = JSON.parse(readFileSync(path, "utf-8")) as Json;
    } catch (e) {
      return err({ kind: "corrupt", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const report = parseVerificationReportDocument(aggregateId, raw);
    if (!report.ok) {
      return err({ kind: "corrupt", path, cause: report.error.cause });
    }
    return report;
  }

  findAllByDirectory(directory: ArtifactPath): Result<VerificationReports, RepositoryError> {
    let entries: string[];
    try {
      entries = readdirSync(directory.asString())
        .filter((f) => f.endsWith(".json") && f !== "cross-check.json")
        .sort();
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: directory.asString(), cause: e instanceof Error ? e.message : String(e) });
    }
    const reports: VerificationReport[] = [];
    for (const file of entries) {
      try {
        const raw = JSON.parse(readFileSync(join(directory.asString(), file), "utf-8")) as Json;
        const report = parseSiblingReportDocument(directory, file, raw);
        if (report !== null) reports.push(report);
      } catch {
        // 読めない兄弟文書は黙って除く——その状態は自分の書き手が報告する。
      }
    }
    return ok(VerificationReports.of(reports));
  }

  conformedOf(report: VerificationReport): VerificationReport {
    return conformToFindingsContract(report, readContractSchema(this.#findingsSchemaPath));
  }

  store(report: VerificationReport): Result<void, RepositoryError> {
    const conformed = this.conformedOf(report);
    const path = join(conformed.id().directory().asString(), conformed.id().fileName());
    try {
      mkdirSync(conformed.id().directory().asString(), { recursive: true });
      writeFileSync(path, renderVerificationReportBytes(conformed), "utf-8");
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
