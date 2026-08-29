// SMT バックエンドの降格レポート群 — 文書に書かれる理由・detail 文言
// （golden 凍結）はドメインのファクトリが逐語で所有する。
// 旧 parentMain の ir-unreadable / ir-version-mismatch / unavailable の
// 各 writeFindingsDoc 呼び出しからの逐語移植。

import { sha256 } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import type { VerificationSkipped } from "./verification-finding.ts";
import { VerificationReport } from "./verification-report.ts";

export const SUPPORTED_IR_MAJOR = 1;

const SMT_METHOD = "exhaustive";

// IR が読めない（fence 不正・JSON 不正・構造不正）。irVersion "0.0.0" と
// 空文字列の sha256 が「モデル不在」の凍結表現。
export function irUnreadableReport(id: VerificationReportId, cause: string): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: "0.0.0",
    irHash: sha256(""),
    method: SMT_METHOD,
    findings: [],
    skipped: [],
    unavailableReason: `IR unreadable: ${cause} — see the deep-spec-ir-valid sensor for details`,
  });
}

// IR の major がこのバックエンドの対応外——全対象を skip として記録する。
export function versionMismatchReport(
  id: VerificationReportId,
  model: RequirementsModel,
  irHash: string,
): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method: SMT_METHOD,
    findings: [],
    skipped: model.allTargets().map((t) => ({
      target: t,
      reason: "ir-version-mismatch",
      detail: `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`,
    })),
  });
}

// ソルバ実行不能——コンパイル時 skip を保ちつつ、残る全対象を unavailable
// として記録する。
export function solverUnavailableReport(
  id: VerificationReportId,
  model: RequirementsModel,
  irHash: string,
  planSkipped: readonly VerificationSkipped[],
  reason: string,
): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method: SMT_METHOD,
    findings: [],
    skipped: [
      ...planSkipped,
      ...model
        .allTargets()
        .filter((t) => !planSkipped.some((s) => s.target === t))
        .map((t) => ({ target: t, reason: "unavailable", detail: "z3 could not be executed" })),
    ],
    unavailableReason: reason,
  });
}
