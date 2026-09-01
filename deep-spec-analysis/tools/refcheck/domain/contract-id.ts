import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type ContractCellError = { readonly kind: "empty-contract-id"; readonly raw: string };

// contracts テーブルの ID 列の値。
export class ContractId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ContractId, ContractCellError> {
    if (raw === "") return err({ kind: "empty-contract-id", raw });
    return ok(new ContractId(raw));
  }

  static reconstitute(raw: string): ContractId {
    return new ContractId(raw);
  }

  equals(other: ContractId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
