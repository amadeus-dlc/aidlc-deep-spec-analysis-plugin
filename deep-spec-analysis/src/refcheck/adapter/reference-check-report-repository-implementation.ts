// ReferenceCheckReportRepository の実 Gateway 実装。
// 保存先／読出元は集約識別子（directory + fileName）から導出する。
// 責務は集約の I/O だけ（オーナー裁定 2026-09-04）——store は渡された集約を
// そのまま公開し、契約適合済みかどうかは問わない。適合は usecase が保存前に
// 一度だけ済ませる（ReferenceCheckReport.conformedTo）ので、ここは schema を
// 読まない。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { type Json } from "@deep-spec/kernel-infrastructure";
import { writeFileAtomically } from "@deep-spec/kernel-adapter";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { ReferenceCheckReport, ReferenceCheckReportIdentifier } from "@deep-spec/refcheck-domain";
import type { ReferenceCheckReportRepository } from "@deep-spec/refcheck-usecase";
import { parseReportDocument, renderReportBytes } from "./reference-check-report-serializer.ts";

const encoder = new TextEncoder();

export class ReferenceCheckReportRepositoryImplementation implements ReferenceCheckReportRepository {
  findById(aggregateId: ReferenceCheckReportIdentifier): Result<ReferenceCheckReport, RepositoryError> {
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
    const report = parseReportDocument(aggregateId, raw);
    if (!report.ok) {
      return err({ kind: "corrupt", path, cause: report.error.cause });
    }
    return report;
  }

  // 往復則: 渡された集約をそのまま（再適合せず）バイトへ描画し、同一ディレク
  // トリの一時ファイルへ書いてから rename で公開する（部分書き込み防止）。
  store(report: ReferenceCheckReport): Result<void, RepositoryError> {
    const path = join(report.id().directory().asString(), report.id().fileName());
    const bytes = encoder.encode(renderReportBytes(report));
    try {
      writeFileAtomically(path, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
