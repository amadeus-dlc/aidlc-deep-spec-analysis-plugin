import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// contracts テーブルの ID 列の値。
export class ContractIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "contract-id-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-contract-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ContractIdentifier {
    return new ContractIdentifier(raw);
  }

  static parse(raw: string): Result<ContractIdentifier, ParseError> {
    return parseConstruction(() => new ContractIdentifier(raw));
  }

  equals(other: ContractIdentifier): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
