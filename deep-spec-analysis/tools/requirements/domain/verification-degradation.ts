// v1 バックエンド共通の降格レポート — 文書に書かれる理由・detail 文言
// （golden 凍結）はドメインのファクトリが逐語で所有する。method はバックエンド
// ごとに凍結（smt は "exhaustive"、quint はこの 2 経路では "simulation"）で、
// 呼び手のユースケースが自分の定数を渡す。

import { sha256 } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import { VerificationReport } from "./verification-report.ts";

export const SUPPORTED_IR_MAJOR = 1;

// IR が読めない（fence 不正・JSON 不正・構造不正）。irVersion "0.0.0" と
// 空文字列の sha256 が「モデル不在」の凍結表現。
export function irUnreadableReport(id: VerificationReportId, method: string, cause: string): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: "0.0.0",
    irHash: sha256(""),
    method,
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
  method: string,
): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method,
    findings: [],
    skipped: model.allTargets().map((t) => ({
      target: t,
      reason: "ir-version-mismatch",
      detail: `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`,
    })),
  });
}
