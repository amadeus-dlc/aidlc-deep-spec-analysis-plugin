import { StructuralDebt } from "../domain/index.ts";
import type { DebtRow } from "../domain/index.ts";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
import type { RefcheckBackendClient } from "./port/refcheck-backend-client.ts";

// 構造負債の走査（checks 配列の第 4 ブロック、report-only）。実在する設計
// 成果物ごとに refcheck バックエンドを打診し、数えられたものだけを走査済み
// 母数に数える（null は不算入——実行不能を 0 findings と混同しない）。
export class CheckStructuralDebtUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  readonly #backend: RefcheckBackendClient;

  constructor(workspace: DoctorWorkspaceClient, backend: RefcheckBackendClient) {
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
      if (findings > 0) rows.push({ space: ref.space, intent: ref.intent, artifact: ref.label, findings });
    }
    return StructuralDebt.of({ scanned, rows });
  }
}
