// components.md の refcheck ユースケース — 型付き入力の上で DD 検査を
// 走らせ、ReferenceCheckReport 集約を組む純粋なアプリケーション操作。
// 入力の取得（ファイル読み）と解析（形式知識）・契約適合・保存は
// 合成ルート＋アダプタの責務で、ここには I/O が存在しない。

import { sha256 } from "../../kernel/domain/index.ts";
import {
  CheckFamilyLedger,
  COMPONENT_FAMILIES,
  type ComponentCatalogOutcome,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  runComponentChecks,
} from "../domain/index.ts";

export interface CheckDomainComponentsInput {
  readonly reportDirectory: string;
  readonly artifact: string;
  readonly artifactText: string;
  readonly catalog: ComponentCatalogOutcome;
}

export class CheckDomainComponentsUseCase {
  execute(input: CheckDomainComponentsInput): ReferenceCheckReport {
    const ledger = new CheckFamilyLedger(COMPONENT_FAMILIES);
    runComponentChecks(input.catalog, input.artifact, ledger);
    return ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "components"),
      inputs: [{ artifact: input.artifact, sha256: sha256(input.artifactText) }],
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
  }
}
