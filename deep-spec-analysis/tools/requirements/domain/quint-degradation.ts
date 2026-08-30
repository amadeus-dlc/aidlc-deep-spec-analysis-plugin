// Quint バックエンド固有の降格レポート（文言は golden 凍結）。
// - CLI 不在：method "simulation" 固定・全対象 unavailable（旧 main の
//   quint --version probe 失敗経路）。
// - 機械コンパイル不能（非有界 int・変数名衝突）：検出済み method のまま、
//   このバックエンドが検査するはずだった全義務・全シナリオを compile-error
//   として記録する（旧 machine === null 経路）。

import type { ContentHash } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import { VerificationReport } from "./verification-report.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

export function quintUnavailableReport(
  id: VerificationReportId,
  model: RequirementsModel,
  irHash: ContentHash,
): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method: "simulation",
    findings: VerificationFindings.of([]),
    skipped: VerificationSkips.of(model.allTargets().map((t) => ({ target: t, reason: "unavailable", detail: "quint CLI missing" }))),
    unavailableReason: "quint CLI is not available (install: npm i -g @informalsystems/quint)",
  });
}

export function machineUncompilableReport(
  id: VerificationReportId,
  model: RequirementsModel,
  irHash: ContentHash,
  method: string,
  machineError: string,
): VerificationReport {
  return VerificationReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method,
    findings: VerificationFindings.of([]),
    skipped: VerificationSkips.of([
      ...model.obligations().toArray().map((ob) => ({ target: ob.id, reason: "compile-error", detail: machineError })),
      ...model.scenarios().toArray().map((sc) => ({ target: sc.id, reason: "compile-error", detail: machineError })),
    ]),
  });
}
