import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// contracts テーブルの ID 列の値。
export class ContractId {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "contract-id-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-contract-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ContractId {
    return new ContractId(raw);
  }

  static parse(raw: string): Result<ContractId, ParseError> {
    return parseConstruction(() => new ContractId(raw));
  }

  equals(other: ContractId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
