// 設計バックエンド共通の降格レポート — 文書に書かれる理由・detail 文言
// （golden 凍結）はドメインのファクトリが逐語で所有する。method は経路ごとに
// 呼び手（entry）が凍結値を渡す（smt: "exhaustive" / quint: ir 系 2 経路は
// "simulation"、127 経路は検出済み method ?? "simulation"）。

import { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import { } from "../../kernel/domain/index.ts";
import type { DesignModel } from "./design-model.ts";
import type { DesignReportId } from "./design-report-id.ts";
import { DesignReport } from "./design-report.ts";

export const SUPPORTED_DESIGN_IR_MAJOR = 1;

// 設計 IR が読めない（fence 不正・JSON 不正・構造不正）。
export function designIrUnreadableReport(id: DesignReportId, method: string, cause: string): DesignReport {
  return DesignReport.compose({
    id,
    irVersion: IrVersion.reconstitute("0.0.0"),
    irHash: ContentHash.ofText(""),
    method,
    findings: [],
    skipped: [],
    unavailableReason: `design IR unreadable: ${cause} — see the deep-spec-design-ir-valid sensor for details`,
  });
}

// 設計 IR の major がこのバックエンドの対応外——全ユニットの全対象を skip。
export function designVersionMismatchReport(
  id: DesignReportId,
  model: DesignModel,
  irHash: ContentHash,
  method: string,
): DesignReport {
  return DesignReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method,
    findings: [],
    skipped: model.units().flatMap((u) =>
      u.allTargets().map((t) => ({
        target: t,
        reason: "ir-version-mismatch",
        unit: u.name(),
        detail: `design IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
      })),
    ),
  });
}

// lowered v1 バックエンドが 127 を返した——全ユニットの全対象を unavailable
// として記録する（skipDetail は backend 固有の凍結語彙：smt "z3 could not be
// executed" / quint "quint CLI missing"）。
export function designBackendUnavailableReport(
  id: DesignReportId,
  model: DesignModel,
  irHash: ContentHash,
  method: string,
  reason: string,
  skipDetail: string,
): DesignReport {
  return DesignReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method,
    findings: [],
    skipped: model.units().flatMap((u) =>
      u.allTargets().map((t) => ({ target: t, reason: "unavailable", unit: u.name(), detail: skipDetail })),
    ),
    unavailableReason: reason,
  });
}
