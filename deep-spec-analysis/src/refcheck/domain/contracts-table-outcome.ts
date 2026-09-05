import type { ContractRows } from "./contract-rows.ts";
import type { ArtifactPath, ErrorMessage } from "@deep-spec/kernel-domain";
import { CD_1, CD_3 } from "./contract-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { UnitDecls } from "./unit-decls.ts";

// contract-summary.md の契約表——Provider 列を持つ表が無い（absent）か、行が
// 読めた（rows）。CD 検査は `match` で解釈へ命じる（#71 波26）。
export class ContractsTableOutcome {
  readonly #rows: ContractRows | null;
  readonly #error: ErrorMessage | null;

  private constructor(rows: ContractRows | null, error: ErrorMessage | null) {
    this.#rows = rows;
    this.#error = error;
  }

  static absent(): ContractsTableOutcome {
    return new ContractsTableOutcome(null, null);
  }

  static rows(rows: ContractRows): ContractsTableOutcome {
    return new ContractsTableOutcome(rows, null);
  }

  static unparseable(error: ErrorMessage): ContractsTableOutcome { return new ContractsTableOutcome(null, error); }

  match<T>(handlers: { absent: () => T; rows: (rows: ContractRows) => T; unparseable: (error: ErrorMessage) => T }): T {
    if (this.#error !== null) return handlers.unparseable(this.#error);
    return this.#rows === null ? handlers.absent() : handlers.rows(this.#rows);
  }


  // CD-1 の門（種別規律の裁定 12）: 表が無ければ skip、あれば各行の当事者が
  // 宣言済みかを行に判定させる（宣言が使えるときだけ）。CD-3 のために行を返す。
  check(report: ReferenceCheckReport, units: UnitDecls | null, artifact: ArtifactPath, depArtifact: ArtifactPath): ContractRows | null {
    return this.match<ContractRows | null>({
      unparseable: (error) => {
        report.skip(CD_1, "unrecognized-format", error.asString());
        report.skip(CD_3, "unrecognized-format", error.asString());
        return null;
      },
      absent: () => {
        if (units !== null) report.skip(CD_1, "unrecognized-format", "no markdown table with a Provider column found");
        report.skip(CD_3, "unrecognized-format", "no contracts table — DAG edge coverage cannot be checked");
        return null;
      },
      rows: (tableRows) => {
        if (units !== null) tableRows.checkPartiesDeclared(units, report, artifact, depArtifact);
        return tableRows;
      },
    });
  }
}
