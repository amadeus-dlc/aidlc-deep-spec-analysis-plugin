// contract-summary.md の refcheck ユースケース — 型付き入力の上で CD 検査を
// 走らせ、ReferenceCheckReport 集約を組む純粋なアプリケーション操作。
// inputs[] の記録規則（対象 md ＋ dep が読めたときのみ dep）は凍結挙動。

import { sha256 } from "../../kernel/domain/index.ts";
import {
  CheckFamilyLedger,
  CONTRACT_FAMILIES,
  type ContractsTableOutcome,
  type DeclaredUnitsOutcome,
  ReferenceCheckReport,
  ReferenceCheckReportId,
  type SpecBlockAssessment,
  runContractChecks,
} from "../domain/index.ts";
import type { InputEntry } from "../domain/index.ts";

export interface CheckContractSummaryInput {
  readonly reportDirectory: string;
  readonly artifact: string;
  readonly artifactText: string;
  readonly depArtifact: string;
  readonly depText: string | null;
  readonly declaredUnits: DeclaredUnitsOutcome;
  readonly contractsTable: ContractsTableOutcome;
  readonly specBlocks: readonly SpecBlockAssessment[];
}

export class CheckContractSummaryUseCase {
  execute(input: CheckContractSummaryInput): ReferenceCheckReport {
    const ledger = new CheckFamilyLedger(CONTRACT_FAMILIES);
    runContractChecks({
      artifact: input.artifact,
      depArtifact: input.depArtifact,
      declaredUnits: input.declaredUnits,
      contractsTable: input.contractsTable,
      specBlocks: input.specBlocks,
    }, ledger);
    const inputs: InputEntry[] = [{ artifact: input.artifact, sha256: sha256(input.artifactText) }];
    if (input.depText !== null) {
      inputs.push({ artifact: input.depArtifact, sha256: sha256(input.depText) });
    }
    return ReferenceCheckReport.compose({
      id: ReferenceCheckReportId.of(input.reportDirectory, "contract-summary"),
      inputs,
      checked: ledger.checkedTargets(),
      findings: ledger.findings(),
      skipped: ledger.skipped(),
    });
  }
}
