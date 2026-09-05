import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// contracts テーブルの ID 列の値。
export class ContractId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-contract-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ContractId {
    return new ContractId(raw);
  }

  static parse(raw: string): Result<ContractId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new ContractId(raw));
  }

  equals(other: ContractId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
