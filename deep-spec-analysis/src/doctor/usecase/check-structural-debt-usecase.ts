import { DebtRow } from "./read-model/debt-row.ts";
import { StructuralDebt } from "./read-model/structural-debt.ts";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
import type { ReferenceCheckBackendClient } from "./port/reference-check-backend-client.ts";

// 構造負債の走査（checks 配列の第 4 ブロック、report-only）。実在する設計
// 成果物ごとに refcheck バックエンドを打診し、数えられたものだけを走査済み
// 母数に数える（null は不算入——実行不能を 0 findings と混同しない）。
export class CheckStructuralDebtUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  readonly #backend: ReferenceCheckBackendClient;

  constructor(workspace: DoctorWorkspaceClient, backend: ReferenceCheckBackendClient) {
    this.#workspace = workspace;
    this.#backend = backend;
  }

  execute(): StructuralDebt {
    const rows: DebtRow[] = [];
    let scanned = 0;
    for (const ref of this.#workspace.designArtifacts()) {
      const findings = this.#backend.reportOnlyFindings(ref.tool, ref.artifactPath);
      if (findings === null) continue;
      scanned += 1;
      if (findings > 0) rows.push(DebtRow.of({ space: ref.space, intent: ref.intent, artifact: ref.label, findings }));
    }
    return StructuralDebt.of({ scanned, rows });
  }
}
