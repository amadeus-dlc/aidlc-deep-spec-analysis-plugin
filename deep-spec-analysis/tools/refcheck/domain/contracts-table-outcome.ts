import type { ContractRows } from "./contract-rows.ts";

// contract-summary.md の契約表——Provider 列を持つ表が無い（absent）か、行が
// 読めた（rows）。CD 検査は `match` で解釈へ命じる（#71 波26）。
export class ContractsTableOutcome {
  readonly #rows: ContractRows | null;

  private constructor(rows: ContractRows | null) {
    this.#rows = rows;
  }

  static absent(): ContractsTableOutcome {
    return new ContractsTableOutcome(null);
  }

  static rows(rows: ContractRows): ContractsTableOutcome {
    return new ContractsTableOutcome(rows);
  }

  match<T>(handlers: { absent: () => T; rows: (rows: ContractRows) => T }): T {
    return this.#rows === null ? handlers.absent() : handlers.rows(this.#rows);
  }
}
