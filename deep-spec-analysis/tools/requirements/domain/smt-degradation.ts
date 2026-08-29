// SMT バックエンド固有の降格レポート — ソルバ実行不能。コンパイル時 skip を
// 保ちつつ、残る全対象を unavailable として記録する（文言は golden 凍結）。
// 旧 parentMain の unavailable 経路の writeFindingsDoc からの逐語移植。

import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import type { VerificationSkipped } from "./verification-finding.ts";
import { VerificationReport } from "./verification-report.ts";

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
    method: "exhaustive",
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
